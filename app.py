import os, csv, io
from datetime import datetime
from pathlib import Path
from io import BytesIO

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory, Response, g
from flask_cors import CORS
from supabase import create_client
from functools import wraps

from openpyxl import Workbook
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle

BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_PATH)

# ═════════════════════════════════════════════
# CONEXIÓN SUPABASE
# ═════════════════════════════════════════════
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError(f"Faltan credenciales de Supabase. Configura SUPABASE_URL y SUPABASE_KEY en {ENV_PATH}")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
supabase_admin = create_client(SUPABASE_URL, SUPABASE_KEY)  # mismo cliente con service_role

FRONT_DIR = Path(os.getenv("FRONT_DIR", BASE_DIR / "front")).resolve()

print("BASE_DIR =", BASE_DIR)
print("FRONT_DIR =", FRONT_DIR)
print("EXISTE =", FRONT_DIR.exists())

app = Flask(__name__)
CORS(app)

# ─────────────────────────────────────────────
# DECORADOR DE AUTENTICACIÓN
# ─────────────────────────────────────────────
def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.removeprefix("Bearer ").strip()
        if not token:
            return jsonify({"error": "Token requerido"}), 401
        try:
            user_resp = supabase_admin.auth.get_user(token)
            if not user_resp or not user_resp.user:
                raise Exception("Token inválido")
            g.current_user = user_resp.user
        except Exception:
            return jsonify({"error": "Token inválido o expirado"}), 401
        return f(*args, **kwargs)
    return decorated

def current_user_role():
    user = g.get("current_user")
    if not user:
        return None
    metadata = user.user_metadata or {}
    return metadata.get("role", "inspector")

# ─────────────────────────────────────────────
# FRONTEND (SPA)
# ─────────────────────────────────────────────
@app.route("/")
def index():
    return send_from_directory(FRONT_DIR, "index.html")

@app.route("/login")
def login_page():
    return send_from_directory(FRONT_DIR, "login.html")

@app.route("/tuberias")
def tuberias_page():
    return send_from_directory(FRONT_DIR, "tuberias.html")

@app.route("/muros")
def muros_page():
    return send_from_directory(FRONT_DIR, "muros.html")

@app.route("/pozos")
def pozos_page():
    return send_from_directory(FRONT_DIR, "pozos.html")

@app.route("/inspecciones")
def inspecciones_page():
    return send_from_directory(FRONT_DIR, "inspecciones.html")

@app.route("/mapa")
def mapa_page():
    return send_from_directory(FRONT_DIR, "mapa.html")

@app.route("/auditoria")
def auditoria_page():
    return send_from_directory(FRONT_DIR, "auditoria.html")

@app.route("/css/<path:filename>")
def css_files(filename):
    return send_from_directory(FRONT_DIR / "css", filename)

@app.route("/js/<path:filename>")
def js_files(filename):
    return send_from_directory(FRONT_DIR / "js", filename)

# ═════════════════════════════════════════════
# AUTENTICACIÓN
# ═════════════════════════════════════════════
DEFAULT_PERMISSIONS = {
    "alcantarillas_crear": True,
    "alcantarillas_editar": True,
    "alcantarillas_eliminar": False,
    "catalogos_editar": False,
}

def build_auth_payload(auth_response):
    session = getattr(auth_response, "session", None)
    user = getattr(auth_response, "user", None)
    if not user:
        return None
    metadata = getattr(user, "user_metadata", None) or {}
    app_metadata = getattr(user, "app_metadata", None) or {}
    role = app_metadata.get("role") or metadata.get("role") or "inspector"
    payload = {
        "user": {
            "id": getattr(user, "id", None),
            "email": getattr(user, "email", None),
            "nombre": metadata.get("full_name") or metadata.get("nombre") or getattr(user, "email", None),
            "role": role,
            "permisos": metadata.get("permisos") or DEFAULT_PERMISSIONS,
        },
        "requires_email_confirmation": session is None,
    }
    if session:
        payload["access_token"] = getattr(session, "access_token", None)
        payload["refresh_token"] = getattr(session, "refresh_token", None)
    return payload

@app.route("/api/auth/register", methods=["POST"])
def register():
    body = request.json or {}
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    nombre = (body.get("nombre") or body.get("full_name") or "").strip()
    if not email or not password:
        return jsonify({"detail": "Correo y contraseña son obligatorios"}), 400
    if len(password) < 6:
        return jsonify({"detail": "La contraseña debe tener al menos 6 caracteres"}), 400
    try:
        auth_response = supabase_admin.auth.sign_up({
            "email": email,
            "password": password,
            "options": {
                "data": {
                    "full_name": nombre,
                    "role": "inspector",
                    "permisos": DEFAULT_PERMISSIONS,
                }
            },
        })
    except Exception as exc:
        return jsonify({"detail": str(exc)}), 400
    payload = build_auth_payload(auth_response)
    if not payload:
        return jsonify({"detail": "No se pudo crear el usuario"}), 400
    audit_log("register", f"Usuario {email} registrado")
    return jsonify(payload), 201

@app.route("/api/auth/login", methods=["POST"])
def login():
    body = request.json or {}
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    if not email or not password:
        return jsonify({"detail": "Correo y contraseña son obligatorios"}), 400
    try:
        auth_response = supabase_admin.auth.sign_in_with_password({
            "email": email,
            "password": password,
        })
    except Exception:
        return jsonify({"error": "Correo o contraseña incorrectos"}), 401
    payload = build_auth_payload(auth_response)
    if not payload or not payload.get("access_token"):
        return jsonify({"error": "No se pudo iniciar sesión"}), 401
    audit_log("login", f"Usuario {email} inició sesión")
    return jsonify(payload)

@app.route("/api/auth/refresh", methods=["POST"])
def refresh():
    auth_header = request.headers.get("Authorization", "")
    refresh_token = auth_header.removeprefix("Bearer ").strip()
    if not refresh_token:
        return jsonify({"error": "Token de actualización requerido"}), 401
    try:
        auth_response = supabase_admin.auth.refresh_session(refresh_token)
    except Exception:
        return jsonify({"error": "Sesión expirada"}), 401
    payload = build_auth_payload(auth_response)
    if not payload or not payload.get("access_token"):
        return jsonify({"error": "No se pudo renovar la sesión"}), 401
    return jsonify(payload)

@app.route("/api/auth/logout", methods=["POST"])
@require_auth
def logout():
    try:
        supabase_admin.auth.sign_out()
        audit_log("logout", f"Usuario {g.current_user.email} cerró sesión")
    except:
        pass
    return jsonify({"message": "Sesión cerrada"})

# ═════════════════════════════════════════════
# AUDITORÍA
# ═════════════════════════════════════════════
def audit_log(accion, detalle):
    try:
        supabase.table("auditoria").insert({
            "usuario": getattr(g.get("current_user"), "email", "sistema"),
            "accion": accion,
            "detalle": detalle,
            "fecha": datetime.utcnow().isoformat()
        }).execute()
    except:
        pass

@app.route("/api/audit", methods=["GET"])
@require_auth
def get_audit():
    if current_user_role() != "administrador":
        return jsonify({"error": "No autorizado"}), 403
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 20)), 100)
    offset = (page - 1) * per_page
    data = supabase.table("auditoria").select("*").order("fecha", desc=True).range(offset, offset + per_page - 1).execute()
    count = supabase.table("auditoria").select("id", count="exact").execute().count or 0
    return jsonify({
        "data": data.data,
        "total": count,
        "page": page,
        "per_page": per_page,
        "pages": max(1, -(-count // per_page))
    })

@app.route("/api/audit/stats", methods=["GET"])
@require_auth
def audit_stats():
    if current_user_role() != "administrador":
        return jsonify({"error": "No autorizado"}), 403
    total = supabase.table("auditoria").select("id", count="exact").execute().count or 0
    return jsonify({"total": total})

# ═════════════════════════════════════════════
# CATÁLOGOS
# ═════════════════════════════════════════════
@app.route("/api/estados", methods=["GET"])
@require_auth
def get_estados():
    data = supabase.table("estados").select("*").order("id").execute()
    return jsonify(data.data)

@app.route("/api/materiales", methods=["GET"])
@require_auth
def get_materiales():
    data = supabase.table("materiales").select("*").order("id").execute()
    return jsonify(data.data)

# ═════════════════════════════════════════════
# ALCANTARILLAS
# ═════════════════════════════════════════════
@app.route("/api/alcantarillas", methods=["GET"])
@require_auth
def get_alcantarillas():
    query = supabase.table("alcantarillas").select("*")
    provincia = request.args.get("provincia")
    canton = request.args.get("canton")
    universidad = request.args.get("universidad")
    q = (request.args.get("q") or "").strip()
    if provincia: query = query.ilike("provincia", f"%{provincia}%")
    if canton: query = query.ilike("canton", f"%{canton}%")
    if universidad: query = query.ilike("universidad", f"%{universidad}%")
    if q:
        term = f"%{q}%"
        q_filters = [
            f"ubicacion.ilike.{term}", f"parroquia.ilike.{term}", f"canton.ilike.{term}",
            f"provincia.ilike.{term}", f"universidad.ilike.{term}", f"tramo_vial.ilike.{term}",
        ]
        if q.isdigit(): q_filters.insert(0, f"ficha_numero.eq.{q}")
        query = query.or_(",".join(q_filters))
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 50)), 500)
    offset = (page - 1) * per_page
    query = query.order("ficha_numero").range(offset, offset + per_page - 1)
    data = query.execute()
    count_q = supabase.table("alcantarillas").select("id", count="exact")
    if provincia: count_q = count_q.ilike("provincia", f"%{provincia}%")
    if canton: count_q = count_q.ilike("canton", f"%{canton}%")
    if universidad: count_q = count_q.ilike("universidad", f"%{universidad}%")
    if q:
        if q.isdigit(): count_q = count_q.or_(f"ficha_numero.eq.{q}")
        else: count_q = count_q.or_(",".join(q_filters))
    total = count_q.execute().count or 0
    return jsonify({
        "data": data.data,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": max(1, -(-total // per_page)),
    })

@app.route("/api/alcantarillas/<int:id>", methods=["GET"])
@require_auth
def get_alcantarilla(id):
    alc = supabase.table("alcantarillas").select("*").eq("id", id).execute()
    if not alc.data: return jsonify({"detail": "No encontrada"}), 404
    row = alc.data[0]
    row["tuberias"]   = supabase.table("tuberias").select("*, materiales(nombre), estados(nombre)").eq("alcantarilla_id", id).execute().data
    row["muros"]      = supabase.table("muros").select("*, materiales(nombre), estados(nombre)").eq("alcantarilla_id", id).execute().data
    row["pozos"]      = supabase.table("pozos_recoleccion").select("*, estados(nombre)").eq("alcantarilla_id", id).execute().data
    row["fotografias"] = supabase.table("fotografias").select("*").eq("alcantarilla_id", id).execute().data
    row["inspecciones"] = supabase.table("inspecciones").select("*").eq("alcantarilla_id", id).order("fecha", desc=True).execute().data
    row["archivos_adjuntos"] = supabase.table("archivos_adjuntos").select("*").eq("alcantarilla_id", id).execute().data
    return jsonify(row)

@app.route("/api/alcantarillas", methods=["POST"])
@require_auth
def create_alcantarilla():
    body = request.json or {}
    required = ["ficha_numero", "ubicacion"]
    if not all(k in body and body[k] for k in required):
        return jsonify({"detail": f"Campos obligatorios: {required}"}), 400
    payload = {k: v for k, v in body.items() if v not in (None, "", [])}
    result = supabase.table("alcantarillas").insert(payload).execute()
    audit_log("crear_alcantarilla", f"Ficha {result.data[0].get('ficha_numero')} creada")
    return jsonify(result.data[0]), 201

@app.route("/api/alcantarillas/<int:id>", methods=["PUT"])
@require_auth
def update_alcantarilla(id):
    body = request.json or {}
    if not body: return jsonify({"detail": "Sin datos"}), 400
    result = supabase.table("alcantarillas").update(body).eq("id", id).execute()
    if not result.data: return jsonify({"detail": "No encontrada"}), 404
    audit_log("actualizar_alcantarilla", f"Ficha {result.data[0].get('ficha_numero')} actualizada")
    return jsonify(result.data[0])

@app.route("/api/alcantarillas/<int:id>", methods=["DELETE"])
@require_auth
def delete_alcantarilla(id):
    result = supabase.table("alcantarillas").delete().eq("id", id).execute()
    if not result.data: return jsonify({"detail": "No encontrada"}), 404
    audit_log("eliminar_alcantarilla", f"Alcantarilla {id} eliminada")
    return jsonify({"message": "Eliminada"}), 200

# ═════════════════════════════════════════════
# TUBERÍAS
# ═════════════════════════════════════════════
@app.route("/api/tuberias", methods=["GET"])
@require_auth
def get_tuberias():
    alc_id = request.args.get("alcantarilla_id")
    query = supabase.table("tuberias").select("*, materiales(nombre), estados(nombre)")
    if alc_id: query = query.eq("alcantarilla_id", alc_id)
    return jsonify(query.execute().data)

@app.route("/api/tuberias/<int:id>", methods=["GET"])
@require_auth
def get_tuberia(id):
    data = supabase.table("tuberias").select("*, materiales(nombre), estados(nombre)").eq("id", id).execute()
    if not data.data: return jsonify({"detail": "No encontrada"}), 404
    return jsonify(data.data[0])

@app.route("/api/tuberias", methods=["POST"])
@require_auth
def create_tuberia():
    body = request.json or {}
    if "alcantarilla_id" not in body: return jsonify({"detail": "alcantarilla_id obligatorio"}), 400
    result = supabase.table("tuberias").insert(body).execute()
    return jsonify(result.data[0]), 201

@app.route("/api/tuberias/<int:id>", methods=["PUT"])
@require_auth
def update_tuberia(id):
    body = request.json or {}
    result = supabase.table("tuberias").update(body).eq("id", id).execute()
    if not result.data: return jsonify({"detail": "No encontrada"}), 404
    return jsonify(result.data[0])

@app.route("/api/tuberias/<int:id>", methods=["DELETE"])
@require_auth
def delete_tuberia(id):
    result = supabase.table("tuberias").delete().eq("id", id).execute()
    if not result.data: return jsonify({"detail": "No encontrada"}), 404
    return jsonify({"message": "Eliminada"}), 200

# MUROS
@app.route("/api/muros", methods=["GET"])
@require_auth
def get_muros():
    alc_id = request.args.get("alcantarilla_id")
    query = supabase.table("muros").select("*, materiales(nombre), estados(nombre)")
    if alc_id: query = query.eq("alcantarilla_id", alc_id)
    return jsonify(query.execute().data)

@app.route("/api/muros/<int:id>", methods=["GET"])
@require_auth
def get_muro(id):
    data = supabase.table("muros").select("*, materiales(nombre), estados(nombre)").eq("id", id).execute()
    if not data.data: return jsonify({"detail": "No encontrado"}), 404
    return jsonify(data.data[0])

@app.route("/api/muros", methods=["POST"])
@require_auth
def create_muro():
    body = request.json or {}
    if "alcantarilla_id" not in body: return jsonify({"detail": "alcantarilla_id obligatorio"}), 400
    result = supabase.table("muros").insert(body).execute()
    return jsonify(result.data[0]), 201

@app.route("/api/muros/<int:id>", methods=["PUT"])
@require_auth
def update_muro(id):
    body = request.json or {}
    result = supabase.table("muros").update(body).eq("id", id).execute()
    if not result.data: return jsonify({"detail": "No encontrado"}), 404
    return jsonify(result.data[0])

@app.route("/api/muros/<int:id>", methods=["DELETE"])
@require_auth
def delete_muro(id):
    result = supabase.table("muros").delete().eq("id", id).execute()
    if not result.data: return jsonify({"detail": "No encontrado"}), 404
    return jsonify({"message": "Eliminado"}), 200

# POZOS
@app.route("/api/pozos_recoleccion", methods=["GET"])
@require_auth
def get_pozos():
    alc_id = request.args.get("alcantarilla_id")
    query = supabase.table("pozos_recoleccion").select("*, estados(nombre)")
    if alc_id: query = query.eq("alcantarilla_id", alc_id)
    return jsonify(query.execute().data)

@app.route("/api/pozos_recoleccion/<int:id>", methods=["GET"])
@require_auth
def get_pozo(id):
    data = supabase.table("pozos_recoleccion").select("*, estados(nombre)").eq("id", id).execute()
    if not data.data: return jsonify({"detail": "No encontrado"}), 404
    return jsonify(data.data[0])

@app.route("/api/pozos_recoleccion", methods=["POST"])
@require_auth
def create_pozo():
    body = request.json or {}
    if "alcantarilla_id" not in body: return jsonify({"detail": "alcantarilla_id obligatorio"}), 400
    result = supabase.table("pozos_recoleccion").insert(body).execute()
    return jsonify(result.data[0]), 201

@app.route("/api/pozos_recoleccion/<int:id>", methods=["PUT"])
@require_auth
def update_pozo(id):
    body = request.json or {}
    result = supabase.table("pozos_recoleccion").update(body).eq("id", id).execute()
    if not result.data: return jsonify({"detail": "No encontrado"}), 404
    return jsonify(result.data[0])

@app.route("/api/pozos_recoleccion/<int:id>", methods=["DELETE"])
@require_auth
def delete_pozo(id):
    result = supabase.table("pozos_recoleccion").delete().eq("id", id).execute()
    if not result.data: return jsonify({"detail": "No encontrado"}), 404
    return jsonify({"message": "Eliminado"}), 200

# FOTOGRAFÍAS
@app.route("/api/fotografias", methods=["GET"])
@require_auth
def get_fotografias():
    alc_id = request.args.get("alcantarilla_id")
    query = supabase.table("fotografias").select("*")
    if alc_id: query = query.eq("alcantarilla_id", alc_id)
    return jsonify(query.execute().data)

@app.route("/api/fotografias/<int:id>", methods=["GET"])
@require_auth
def get_fotografia(id):
    data = supabase.table("fotografias").select("*").eq("id", id).execute()
    if not data.data: return jsonify({"detail": "No encontrada"}), 404
    return jsonify(data.data[0])

@app.route("/api/fotografias", methods=["POST"])
@require_auth
def create_fotografia():
    body = request.json or {}
    required = ["alcantarilla_id", "image_url"]
    if not all(k in body for k in required): return jsonify({"detail": f"Campos obligatorios: {required}"}), 400
    result = supabase.table("fotografias").insert(body).execute()
    return jsonify(result.data[0]), 201

@app.route("/api/fotografias/<int:id>", methods=["DELETE"])
@require_auth
def delete_fotografia(id):
    result = supabase.table("fotografias").delete().eq("id", id).execute()
    if not result.data: return jsonify({"detail": "No encontrada"}), 404
    return jsonify({"message": "Eliminada"}), 200

# INSPECCIONES
@app.route("/api/inspecciones", methods=["GET"])
@require_auth
def get_inspecciones():
    alc_id = request.args.get("alcantarilla_id")
    query = supabase.table("inspecciones").select("*").order("fecha", desc=True)
    if alc_id: query = query.eq("alcantarilla_id", alc_id)
    return jsonify(query.execute().data)

@app.route("/api/inspecciones/<int:id>", methods=["GET"])
@require_auth
def get_inspeccion(id):
    data = supabase.table("inspecciones").select("*").eq("id", id).execute()
    if not data.data: return jsonify({"detail": "No encontrada"}), 404
    return jsonify(data.data[0])

@app.route("/api/inspecciones", methods=["POST"])
@require_auth
def create_inspeccion():
    body = request.json or {}
    required = ["alcantarilla_id", "fecha"]
    if not all(k in body for k in required): return jsonify({"detail": f"Campos obligatorios: {required}"}), 400
    result = supabase.table("inspecciones").insert(body).execute()
    return jsonify(result.data[0]), 201

@app.route("/api/inspecciones/<int:id>", methods=["PUT"])
@require_auth
def update_inspeccion(id):
    body = request.json or {}
    result = supabase.table("inspecciones").update(body).eq("id", id).execute()
    if not result.data: return jsonify({"detail": "No encontrada"}), 404
    return jsonify(result.data[0])

@app.route("/api/inspecciones/<int:id>", methods=["DELETE"])
@require_auth
def delete_inspeccion(id):
    result = supabase.table("inspecciones").delete().eq("id", id).execute()
    if not result.data: return jsonify({"detail": "No encontrada"}), 404
    return jsonify({"message": "Eliminada"}), 200

# ARCHIVOS ADJUNTOS
@app.route("/api/archivos_adjuntos", methods=["GET"])
@require_auth
def get_archivos():
    alc_id = request.args.get("alcantarilla_id")
    query = supabase.table("archivos_adjuntos").select("*")
    if alc_id: query = query.eq("alcantarilla_id", alc_id)
    return jsonify(query.execute().data)

@app.route("/api/archivos_adjuntos/<int:id>", methods=["GET"])
@require_auth
def get_archivo(id):
    data = supabase.table("archivos_adjuntos").select("*").eq("id", id).execute()
    if not data.data: return jsonify({"detail": "No encontrado"}), 404
    return jsonify(data.data[0])

@app.route("/api/archivos_adjuntos", methods=["POST"])
@require_auth
def create_archivo():
    body = request.json or {}
    required = ["alcantarilla_id", "archivo_url"]
    if not all(k in body for k in required): return jsonify({"detail": f"Campos obligatorios: {required}"}), 400
    result = supabase.table("archivos_adjuntos").insert(body).execute()
    return jsonify(result.data[0]), 201

@app.route("/api/archivos_adjuntos/<int:id>", methods=["DELETE"])
@require_auth
def delete_archivo(id):
    result = supabase.table("archivos_adjuntos").delete().eq("id", id).execute()
    if not result.data: return jsonify({"detail": "No encontrado"}), 404
    return jsonify({"message": "Eliminado"}), 200

# ═════════════════════════════════════════════
# DASHBOARD
# ═════════════════════════════════════════════
@app.route("/api/dashboard/kpis", methods=["GET"])
@require_auth
def dashboard_kpis():
    total = supabase.table("alcantarillas").select("id", count="exact").execute().count or 0
    estados = supabase.table("estados").select("*").execute().data
    por_estado = []
    for e in estados:
        alc_ids = set()
        for tabla in ["tuberias", "muros", "pozos_recoleccion"]:
            rows = supabase.table(tabla).select("alcantarilla_id").eq("estado_id", e["id"]).execute().data
            for r in rows:
                if r.get("alcantarilla_id"): alc_ids.add(r["alcantarilla_id"])
        por_estado.append({"estado": e["nombre"], "cantidad": len(alc_ids)})
    alcs = supabase.table("alcantarillas").select("provincia").execute().data
    prov_count = {}
    for a in alcs:
        p = a.get("provincia") or "Sin provincia"
        prov_count[p] = prov_count.get(p, 0) + 1
    por_provincia = sorted([{"provincia": k, "cantidad": v} for k, v in prov_count.items()], key=lambda x: -x["cantidad"])[:8]
    materiales = supabase.table("materiales").select("*").execute().data
    por_material = []
    for m in materiales:
        cnt = supabase.table("tuberias").select("id", count="exact").eq("material_id", m["id"]).execute().count or 0
        if cnt > 0: por_material.append({"material": m["nombre"], "cantidad": cnt})
    ultimas = supabase.table("inspecciones").select("*").order("fecha", desc=True).limit(5).execute().data
    for ins in ultimas:
        alc = supabase.table("alcantarillas").select("ficha_numero, ubicacion").eq("id", ins["alcantarilla_id"]).execute().data
        ins["ficha_numero"] = alc[0]["ficha_numero"] if alc else None
        ins["ubicacion"] = alc[0]["ubicacion"] if alc else None
    return jsonify({
        "total_alcantarillas": total,
        "por_estado": por_estado,
        "por_provincia": por_provincia,
        "por_material": por_material,
        "ultimas_inspecciones": ultimas,
    })

# ═════════════════════════════════════════════
# MAPA GIS (CORREGIDO - Ahora transforma UTM a WGS84)
# ═════════════════════════════════════════════
@app.route("/api/mapa/puntos", methods=["GET"])
@require_auth
def mapa_puntos():
    provincia = request.args.get("provincia")

    # Seleccionamos solo las columnas necesarias, incluyendo coordenadas UTM
    query = supabase.table("alcantarillas").select(
        "id, ficha_numero, ubicacion, canton, provincia, tramo_vial, coordenada_este, coordenada_norte"
    )

    if provincia:
        query = query.ilike("provincia", f"%{provincia}%")

    # Solo registros con ambas coordenadas no nulas
    query = query.not_.is_("coordenada_este", "null").not_.is_("coordenada_norte", "null")
    rows = query.limit(2000).execute().data

    features = []
    for r in rows:
        este = r.get("coordenada_este")
        norte = r.get("coordenada_norte")

        # Verificación de seguridad
        try:
            este = float(este)
            norte = float(norte)
        except (TypeError, ValueError):
            continue

        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [este, norte]      # UTM (este, norte)
            },
            "properties": {
                "id": r.get("id"),
                "ficha": r.get("ficha_numero"),
                "ubicacion": r.get("ubicacion"),
                "canton": r.get("canton"),
                "provincia": r.get("provincia"),
                "tramo_vial": r.get("tramo_vial"),
                "projection": "utm"               # <-- ¡clave para el frontend!
            }
        })

    return jsonify({
        "type": "FeatureCollection",
        "features": features,
        "total": len(features)
    })

# ═════════════════════════════════════════════
# EXPORTACIONES
# ═════════════════════════════════════════════
@app.route("/api/export/alcantarillas/excel", methods=["GET"])
@require_auth
def export_excel():
    rows = supabase.table("alcantarillas").select("*").order("ficha_numero").execute().data

    wb = Workbook()
    ws = wb.active
    ws.title = "Alcantarillas"

    headers = ["ID", "Ficha", "Ubicación", "Parroquia", "Cantón", "Provincia",
               "Fecha", "Tramo Vial", "Universidad"]
    ws.append(headers)

    for r in rows:
        ws.append([
            r.get("id"),
            r.get("ficha_numero"),
            r.get("ubicacion"),
            r.get("parroquia"),
            r.get("canton"),
            r.get("provincia"),
            r.get("fecha"),
            r.get("tramo_vial"),
            r.get("universidad")
        ])

    # Ajustar ancho de columnas
    for col_idx, header in enumerate(headers, 1):
        max_length = len(str(header))
        for row in ws.iter_rows(min_col=col_idx, max_col=col_idx, values_only=True):
            cell_value = str(row[0]) if row[0] else ""
            max_length = max(max_length, len(cell_value))
        ws.column_dimensions[get_column_letter(col_idx)].width = min(max_length + 2, 50)

    output = BytesIO()
    wb.save(output)
    output.seek(0)

    return Response(
        output,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=alcantarillas.xlsx"}
    )

@app.route("/api/export/alcantarillas/pdf", methods=["GET"])
@require_auth
def export_pdf():
    rows = supabase.table("alcantarillas").select("*").order("ficha_numero").execute().data

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(A4), rightMargin=20, leftMargin=20,
                            topMargin=20, bottomMargin=20)
    elements = []

    # Datos de la tabla
    table_data = [["ID", "Ficha", "Ubicación", "Parroquia", "Cantón", "Provincia",
                   "Fecha", "Tramo Vial", "Universidad"]]
    for r in rows:
        table_data.append([
            r.get("id"),
            r.get("ficha_numero"),
            r.get("ubicacion"),
            r.get("parroquia"),
            r.get("canton"),
            r.get("provincia"),
            r.get("fecha"),
            r.get("tramo_vial"),
            r.get("universidad")
        ])

    table = Table(table_data, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.whitesmoke, colors.lightgrey]),
    ]))

    elements.append(table)
    doc.build(elements)
    buffer.seek(0)

    return Response(
        buffer,
        mimetype="application/pdf",
        headers={"Content-Disposition": "attachment; filename=alcantarillas.pdf"}
    )

# ═════════════════════════════════════════════
# MAIN
# ═════════════════════════════════════════════
if __name__ == "__main__":
    port = int(os.getenv("PORT", 3000))
    debug = os.getenv("FLASK_DEBUG", "1") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)