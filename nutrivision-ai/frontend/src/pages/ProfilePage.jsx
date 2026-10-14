import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Camera,
  TrendingUp,
  LogOut,
  Pencil,
  Cake,
  Weight,
  Ruler,
  ChevronRight,
  Flame,
  Beef,
  Wheat,
  Droplet,
  Crown,
  Smartphone,
  LineChart,
  Lock,
  Activity,
  UserRound,
} from "lucide-react";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import LoadingScreen from "../components/LoadingScreen";
import Portal from "../components/Portal";
import { Message, NumberField, OptionCard, PageTitle, SectionHeader } from "../components/ui";
import { ACTIVITY_OPTIONS, GOAL_OPTIONS, SEX_OPTIONS, findOption } from "../constants/profile";
import { displayAge } from "../utils/age";
import { dayMonth, fmtLongDate } from "../utils/dates";

const MACROS = [
  { key: "dailyCalorieGoal", label: "Calorías", unit: "kcal", color: "var(--color-primary)", Icon: Flame, min: 500, max: 8000 },
  { key: "dailyProteinGoalG", label: "Proteínas", unit: "g", color: "var(--macro-protein)", Icon: Beef, min: 0, max: 500 },
  { key: "dailyCarbsGoalG", label: "Carbohidratos", unit: "g", color: "var(--macro-carbs)", Icon: Wheat, min: 0, max: 900 },
  { key: "dailyFatGoalG", label: "Grasas", unit: "g", color: "var(--macro-fats)", Icon: Droplet, min: 0, max: 400 },
];

const emptyForm = (profile) => ({
  displayName: profile?.displayName || "",
  weightKg: profile?.weightKg ?? "",
  heightCm: profile?.heightCm ?? "",
  activityLevel: profile?.activityLevel ?? "MODERATE",
  goal: profile?.goal ?? "MAINTAIN",
});

// Rangos que valida el backend (routes/user.routes.js)
const RANGES = {
  weightKg: { label: "El peso", min: 20, max: 400 },
  heightCm: { label: "La altura", min: 80, max: 260 },
};

const emptyMacroForm = (profile) => ({
  dailyCalorieGoal: profile?.dailyCalorieGoal ?? "",
  dailyProteinGoalG: profile?.dailyProteinGoalG ?? "",
  dailyCarbsGoalG: profile?.dailyCarbsGoalG ?? "",
  dailyFatGoalG: profile?.dailyFatGoalG ?? "",
});

export default function ProfilePage() {
  const { profile, setProfile, logout, firebaseUser, streak } = useAuth();
  const navigate = useNavigate();
  const photoInputRef = useRef(null);

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(() => emptyForm(profile));
  const [macroForm, setMacroForm] = useState(() => emptyMacroForm(profile));
  const [macrosTouched, setMacrosTouched] = useState(false);

  const [weightHistory, setWeightHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showGoalChangeConfirm, setShowGoalChangeConfirm] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await apiClient.get("/history/summary");
        setWeightHistory(data.weightHistory);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const nameForInitials = profile?.displayName || firebaseUser?.email || "?";
  const initials = nameForInitials
    .trim()
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function handleEnterEdit() {
    setForm(emptyForm(profile));
    setMacroForm(emptyMacroForm(profile));
    setMacrosTouched(false);
    setError(null);
    setSuccess(false);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setError(null);
    setIsEditing(false);
  }

  function updateMacroField(field, value) {
    setMacroForm((m) => ({ ...m, [field]: value }));
    setMacrosTouched(true);
  }

  // Solo se mandan los datos que cambiaron (igual que en mobile): así el gráfico
  // de peso suma un punto únicamente cuando cambiás el peso, y las metas no se
  // recalculan si no tocaste nada que las afecte.
  function buildPayload() {
    if (!form.displayName.trim()) return { problem: "Escribí tu nombre." };
    for (const key of ["weightKg", "heightCm"]) {
      const n = Number(String(form[key]).replace(",", "."));
      const { label, min, max } = RANGES[key];
      if (form[key] === "" || Number.isNaN(n)) return { problem: `Completá ${label.toLowerCase()}.` };
      if (n < min || n > max) return { problem: `${label} tiene que estar entre ${min} y ${max}.` };
    }
    if (macrosTouched) {
      for (const { key, label, min, max } of MACROS) {
        const n = Number(macroForm[key]);
        if (macroForm[key] === "" || !Number.isInteger(n) || n < min || n > max) {
          return { problem: `${label}: tiene que ser un número entero entre ${min} y ${max}.` };
        }
      }
    }

    const payload = {};
    if (form.displayName.trim() !== (profile?.displayName || "")) payload.displayName = form.displayName.trim();
    for (const key of ["weightKg", "heightCm"]) {
      const n = Number(String(form[key]).replace(",", "."));
      if (n !== profile?.[key]) payload[key] = n;
    }
    for (const key of ["activityLevel", "goal"]) {
      if (form[key] && form[key] !== profile?.[key]) payload[key] = form[key];
    }
    if (macrosTouched) {
      for (const { key } of MACROS) {
        const n = Number(macroForm[key]);
        if (n !== profile?.[key]) payload[key] = n;
      }
    }
    return { payload };
  }

  async function handleSave() {
    const { problem, payload } = buildPayload();
    setShowGoalChangeConfirm(false);
    if (problem) {
      setError(problem);
      return;
    }
    if (!Object.keys(payload).length) {
      setIsEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const { data } = await apiClient.patch("/users/me", payload);
      setProfile(data.user);
      setSuccess(true);
      setIsEditing(false);
      // El gráfico solo cambia si cambió el peso o el objetivo (que lo reinicia).
      if (payload.weightKg !== undefined || payload.goal !== undefined) {
        const { data: summary } = await apiClient.get("/history/summary");
        setWeightHistory(summary.weightHistory);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleSaveClick() {
    if (form.goal !== profile?.goal) {
      setShowGoalChangeConfirm(true);
    } else {
      handleSave();
    }
  }

  function confirmGoalChangeAndSave() {
    setShowGoalChangeConfirm(false);
    handleSave();
  }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const { data } = await apiClient.patch("/users/me/photo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setProfile(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  if (loading) return <LoadingScreen label="Cargando tu perfil…" />;

  const first = weightHistory[0]?.weightKg;
  const last = weightHistory[weightHistory.length - 1]?.weightKg;
  const delta = first != null && last != null ? last - first : null;
  // Eje X con la fecha real de cada registro de peso.
  const chartData = weightHistory.map((w) => ({
    label: dayMonth(new Date(w.loggedAt)),
    date: w.loggedAt,
    peso: w.weightKg,
  }));
  const age = displayAge(profile);
  const sexLabel = findOption(SEX_OPTIONS, profile?.sex)?.label;
  const activeActivity = findOption(ACTIVITY_OPTIONS, profile?.activityLevel);
  const ActivityIcon = activeActivity?.Icon || Activity;
  const activeGoal =
    GOAL_OPTIONS.find((g) => g.value === profile?.goal) ||
    GOAL_OPTIONS.find((g) => g.value === "MAINTAIN");
  const ActiveGoalIcon = activeGoal.Icon;
  const isPremium = profile?.plan === "PREMIUM";
  const fmtKg = (v) => `${Number(v).toLocaleString("es-AR", { maximumFractionDigits: 1 })} kg`;

  const titleActions = isEditing ? (
    <>
      <button type="button" className="pill-btn pill-btn--outline" onClick={handleCancelEdit} disabled={saving}>
        Cancelar
      </button>
      <button type="button" className="pill-btn pill-btn--solid" onClick={handleSaveClick} disabled={saving}>
        {saving ? "Guardando…" : "Guardar"}
      </button>
    </>
  ) : (
    <button type="button" className="pill-btn pill-btn--soft" onClick={handleEnterEdit}>
      <Pencil size={14} /> Editar
    </button>
  );

  return (
    <div className="page profile-page">
      <PageTitle title="Perfil" right={titleActions} />

      {error && <Message>{error}</Message>}
      {success && <Message tone="success">Cambios guardados.</Message>}

      {/* Encabezado: foto, nombre, email */}
      <section className="profile-hero">
        <div className="profile-hero__avatar-wrap">
          <div className="profile-hero__avatar">
            {uploadingPhoto ? (
              <span className="profile-hero__spinner" aria-label="Subiendo foto" />
            ) : profile?.photoUrl ? (
              <img src={profile.photoUrl} alt="Tu foto de perfil" />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          {isEditing && (
            <button
              type="button"
              className="profile-hero__camera"
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
              aria-label="Cambiar foto de perfil"
            >
              <Camera size={14} />
            </button>
          )}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={handlePhotoChange}
          />
        </div>
        <div className="profile-hero__info">
          <h2>{profile?.displayName || "Sin nombre"}</h2>
          <p>{firebaseUser?.email}</p>
          <div className="profile-hero__badges">
            <span className="badge badge--light">
              {isPremium ? <Crown size={11} /> : null}
              {isPremium ? "Premium" : "Plan Gratuito"}
            </span>
            <span className="badge badge--light">
              <Flame size={11} /> {streak} {streak === 1 ? "día" : "días"}
            </span>
          </div>
        </div>
      </section>

      {isEditing ? (
        <div className="profile-page__edit">
          <section className="card profile-page__stack profile-page__edit-wide">
            <SectionHeader title="Datos personales" />
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="displayName">Nombre</label>
              <input
                id="displayName"
                className="input"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                maxLength={100}
                placeholder="Tu nombre"
              />
            </div>
            {/* Edad y sexo no se editan: la edad se calcula sola y el sexo se define al registrarse. */}
            <div className="profile-page__fields2">
              <LockedField label="Edad" value={age != null ? `${age} años` : "—"} />
              <LockedField label="Sexo" value={sexLabel || "—"} />
            </div>
            <div className="profile-page__fields2">
              <NumberField id="height" label="Altura" unit="cm" min="80" max="260" value={form.heightCm} onChange={(v) => setForm({ ...form, heightCm: v })} />
              <NumberField id="weight" label="Peso actual" unit="kg" min="20" max="400" step="0.1" value={form.weightKg} onChange={(v) => setForm({ ...form, weightKg: v })} />
            </div>
          </section>

          <section className="card profile-page__stack">
            <SectionHeader title="Objetivo" />
            <div className="profile-page__options" role="radiogroup" aria-label="Objetivo">
              {GOAL_OPTIONS.map((o) => (
                <OptionCard key={o.value} option={o} compact active={form.goal === o.value} onSelect={() => setForm({ ...form, goal: o.value })} />
              ))}
            </div>
          </section>

          <section className="card profile-page__stack">
            <SectionHeader title="Nivel de actividad" />
            <div className="profile-page__options" role="radiogroup" aria-label="Nivel de actividad">
              {ACTIVITY_OPTIONS.map((o) => (
                <OptionCard key={o.value} option={o} compact active={form.activityLevel === o.value} onSelect={() => setForm({ ...form, activityLevel: o.value })} />
              ))}
            </div>
          </section>

          <section className="card profile-page__stack profile-page__edit-wide">
            <SectionHeader title="Metas diarias" />
            <p className="hint" style={{ marginTop: -6 }}>
              {macrosTouched
                ? "Vas a usar tus propias metas: tienen prioridad sobre el cálculo automático."
                : "Se calculan solas según tu objetivo, pero las podés ajustar como quieras."}
            </p>
            <div className="profile-page__fields4">
              {MACROS.map(({ key, label, unit, min, max }) => (
                <NumberField
                  key={key}
                  id={key}
                  label={label}
                  unit={unit}
                  min={min}
                  max={max}
                  value={macroForm[key]}
                  onChange={(v) => updateMacroField(key, v)}
                />
              ))}
            </div>
          </section>

          <button type="button" className="btn btn-primary btn-block profile-page__edit-wide" onClick={handleSaveClick} disabled={saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      ) : (
        <div className="profile-page__grid">
          <div className="profile-page__col">
            {/* Peso inicial / progreso / actual */}
            <div className="profile-page__stats">
              <div className="profile-page__stat">
                <strong>{first != null ? fmtKg(first) : "—"}</strong>
                <span>Peso inicial</span>
              </div>
              <div className="profile-page__stat">
                <strong style={{ color: "var(--color-primary)" }}>
                  {delta != null
                    ? `${delta > 0 ? "+" : ""}${delta.toLocaleString("es-AR", { maximumFractionDigits: 1 })} kg`
                    : "—"}
                </strong>
                <span>Progreso</span>
              </div>
              <div className="profile-page__stat">
                <strong>{last != null ? fmtKg(last) : "—"}</strong>
                <span>Peso actual</span>
              </div>
            </div>

            {/* Métricas */}
            <section className="card">
              <SectionHeader title="Tus métricas" />
              <div className="profile-page__metrics">
                <Metric Icon={Cake} label="Edad" value={age} unit="años" />
                <Metric Icon={Weight} label="Peso" value={profile?.weightKg} unit="kg" />
                <Metric Icon={Ruler} label="Altura" value={profile?.heightCm} unit="cm" />
                <Metric Icon={UserRound} label="Sexo" value={sexLabel} />
              </div>
            </section>

            {/* Objetivo */}
            <section className="card profile-page__info">
              <span className="icon-tile"><ActiveGoalIcon size={20} /></span>
              <div>
                <span className="profile-page__info-label">Objetivo actual</span>
                <span className="profile-page__info-value">{activeGoal.label}</span>
                <span className="profile-page__info-hint">{activeGoal.subtitle}</span>
              </div>
            </section>

            {/* Nivel de actividad */}
            <section className="card profile-page__info">
              <span className="icon-tile icon-tile--water"><ActivityIcon size={20} /></span>
              <div>
                <span className="profile-page__info-label">Nivel de actividad</span>
                <span className="profile-page__info-value">{activeActivity?.label ?? "Sin definir"}</span>
                <span className="profile-page__info-hint">{activeActivity?.desc}</span>
              </div>
            </section>

            {/* Menú */}
            <section className="card profile-page__menu">
              <Link to="/pricing" className="menu-row">
                <span className="icon-tile icon-tile--accent"><Crown size={18} /></span>
                <span className="menu-row__text">
                  <span className="menu-row__label">Plan y precios</span>
                  <span className="menu-row__hint">{isPremium ? "Premium" : "Gratuito"}</span>
                </span>
                <ChevronRight size={18} className="menu-row__chevron" />
              </Link>
              <Link to="/download" className="menu-row">
                <span className="icon-tile"><Smartphone size={18} /></span>
                <span className="menu-row__text">
                  <span className="menu-row__label">Descargar la app</span>
                  <span className="menu-row__hint">NutriVision IA en tu celular</span>
                </span>
                <ChevronRight size={18} className="menu-row__chevron" />
              </Link>
            </section>

          </div>

          <div className="profile-page__col">
            {/* Metas diarias */}
            <section className="card">
              <SectionHeader title="Metas diarias" />
              <div className="profile-page__goals">
                {MACROS.map(({ key, label, unit, color, Icon }) => (
                  <div className="profile-page__goal" key={key}>
                    <span className="profile-page__goal-top">
                      <Icon size={14} color={color} /> {label}
                    </span>
                    <strong>
                      {profile?.[key] ?? "—"} <small>{unit}</small>
                    </strong>
                  </div>
                ))}
              </div>
              <p className="hint" style={{ marginTop: 10 }}>
                Se calculan solas según tus datos y tu objetivo, pero las podés ajustar desde Editar.
              </p>
            </section>

            {/* Evolución de peso */}
            <section className="card">
              <SectionHeader title="Evolución de peso" icon={<LineChart size={18} color="var(--color-primary)" />} />
              {first != null && last != null && chartData.length > 1 && (
                <p className="profile-page__chart-delta">
                  <TrendingUp size={15} />
                  {delta >= 0 ? "+" : ""}
                  {delta.toFixed(1).replace(".", ",")} kg desde el {fmtLongDate(chartData[0].date)}
                </p>
              )}
              {chartData.length > 1 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#189B4E" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#189B4E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#E4E6EA" />
                    <XAxis dataKey="label" stroke="#9AA0A8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#9AA0A8" fontSize={12} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                    <Tooltip
                      contentStyle={{
                        fontFamily: "var(--font-body)",
                        borderRadius: 12,
                        border: "none",
                        boxShadow: "0 6px 16px rgba(23,25,28,0.12)",
                      }}
                      formatter={(v) => [`${String(v).replace(".", ",")} kg`, "Peso"]}
                      labelFormatter={(_, items) => (items?.[0]?.payload?.date ? fmtLongDate(items[0].payload.date) : "")}
                    />
                    <Area
                      type="monotone"
                      dataKey="peso"
                      stroke="#189B4E"
                      strokeWidth={3}
                      fill="url(#weightFill)"
                      dot={{ r: 4, fill: "#fff", stroke: "#189B4E", strokeWidth: 2.5 }}
                      activeDot={{ r: 6 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="hint">
                  Todavía no hay suficientes registros de peso para graficar tu progreso. Se suman
                  automáticamente cada vez que actualizás tu peso desde Editar.
                </p>
              )}
            </section>
          </div>
        </div>
      )}

      {!isEditing && (
        <button type="button" className="btn btn-danger-soft profile-page__logout" onClick={() => setShowLogoutConfirm(true)}>
          <LogOut size={18} /> Cerrar sesión
        </button>
      )}

      {showGoalChangeConfirm && (
        <Portal>
        <div className="modal-overlay" onClick={() => setShowGoalChangeConfirm(false)}>
          <div className="modal-panel confirm-modal" onClick={(e) => e.stopPropagation()}>
            <span className="icon-tile"><TrendingUp size={26} /></span>
            <h3>¿Cambiar de objetivo?</h3>
            <p>
              Tu gráfico de evolución de peso se va a reiniciar: el peso actual pasa a ser tu nuevo
              punto de partida.
            </p>
            <div className="confirm-modal__actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowGoalChangeConfirm(false)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={confirmGoalChangeAndSave} disabled={saving}>
                {saving ? "Guardando…" : "Sí, cambiar"}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {showLogoutConfirm && (
        <Portal>
        <div className="modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="modal-panel confirm-modal" onClick={(e) => e.stopPropagation()}>
            <span className="icon-tile icon-tile--danger"><LogOut size={26} /></span>
            <h3>¿Cerrar sesión?</h3>
            <p>Vas a salir de tu cuenta. Podés volver a ingresar cuando quieras.</p>
            <div className="confirm-modal__actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowLogoutConfirm(false)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-danger" onClick={handleLogout}>
                Sí, salir
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      <style>
        {`
        /* Encabezado verde */
        .profile-hero {
          display: flex; align-items: center; gap: 16px; background: var(--gradient-primary); color: #fff;
          border-radius: var(--radius-lg); padding: 20px; box-shadow: var(--shadow-card);
        }
        .profile-hero__avatar-wrap { position: relative; flex-shrink: 0; }
        .profile-hero__avatar {
          width: 76px; height: 76px; border-radius: 50%; background: #fff; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          color: var(--color-primary); font-size: 1.6rem; font-weight: 800;
        }
        .profile-hero__avatar img { width: 100%; height: 100%; object-fit: cover; }
        .profile-hero__spinner {
          width: 28px; height: 28px; border-radius: 50%; border: 3px solid var(--color-primary-soft);
          border-top-color: var(--color-primary); animation: spin 0.9s linear infinite;
        }
        .profile-hero__camera {
          position: absolute; right: -2px; bottom: -2px; width: 30px; height: 30px; border-radius: 50%;
          background: var(--color-primary-dark); color: #fff; border: 2.5px solid #fff; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }
        .profile-hero__info { flex: 1; min-width: 0; }
        .profile-hero__info h2 { margin: 0; color: #fff; font-size: 1.35rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .profile-hero__info p { margin: 2px 0 0; opacity: 0.88; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; }
        .profile-hero__badges { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }

        /* Vista */
        .profile-page__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
        @media (max-width: 960px) { .profile-page__grid { grid-template-columns: 1fr; gap: 16px; } }
        .profile-page__col { display: flex; flex-direction: column; gap: 16px; }

        .profile-page__stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .profile-page__stat {
          background: var(--color-surface); border-radius: var(--radius-md); box-shadow: var(--shadow-soft);
          padding: 14px 6px; text-align: center; display: flex; flex-direction: column;
        }
        .profile-page__stat strong { font-size: 1.08rem; font-weight: 800; white-space: nowrap; }
        .profile-page__stat span { font-size: 0.74rem; color: var(--color-ink-soft); margin-top: 2px; }

        .profile-page__metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        @media (max-width: 420px) { .profile-page__metrics { grid-template-columns: 1fr 1fr; } }
        .profile-metric {
          background: var(--color-bg); border-radius: var(--radius-md); padding: 12px 6px;
          display: flex; flex-direction: column; align-items: center; gap: 4px;
        }
        .profile-metric svg { color: var(--color-primary); }
        .profile-metric span { font-size: 0.74rem; color: var(--color-ink-soft); font-weight: 600; }
        .profile-metric strong { font-size: 1.05rem; font-weight: 800; }
        .profile-metric small { font-size: 0.74rem; font-weight: 600; color: var(--color-ink-soft); }

        .profile-page__info { display: flex; align-items: center; gap: 12px; }
        .profile-page__info > div { display: flex; flex-direction: column; flex: 1; }
        .profile-page__info-label { font-size: 0.78rem; color: var(--color-ink-soft); font-weight: 600; }
        .profile-page__info-value { font-size: 1rem; font-weight: 800; }
        .profile-page__info-hint { font-size: 0.8rem; color: var(--color-ink-muted); }

        .profile-page__menu { padding-top: 4px; padding-bottom: 4px; }
        /* Solo en pantallas chicas: ahí el menú lateral (que tiene cerrar sesión) se oculta */
        .profile-page__logout { display: none; }
        @media (max-width: 900px) { .profile-page__logout { display: inline-flex; align-self: stretch; } }

        .profile-page__goals { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .profile-page__goal { background: var(--color-bg); border-radius: var(--radius-md); padding: 12px; display: flex; flex-direction: column; gap: 4px; }
        .profile-page__goal-top { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; font-weight: 600; color: var(--color-ink-soft); }
        .profile-page__goal strong { font-size: 1.2rem; font-weight: 800; }
        .profile-page__goal small { font-size: 0.78rem; font-weight: 600; color: var(--color-ink-soft); }

        .profile-page__chart-delta {
          display: inline-flex; align-items: center; gap: 6px; margin: -4px 0 10px; padding: 4px 10px; border-radius: 999px;
          background: var(--color-primary-soft); color: var(--color-primary-dark); font-size: 0.8rem; font-weight: 800;
        }

        /* Edición */
        .profile-page__edit { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: stretch; }
        .profile-page__edit-wide { grid-column: 1 / -1; }
        @media (max-width: 960px) { .profile-page__edit { grid-template-columns: 1fr; gap: 16px; } }
        .profile-page__stack { display: flex; flex-direction: column; gap: 14px; }
        .profile-page__stack .section-header { margin-bottom: 0; }
        .profile-page__fields3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .profile-page__fields2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .profile-locked {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
          background: var(--color-bg); border: 1.5px solid var(--color-line); border-radius: var(--radius-md);
          padding: 11px 14px; font-weight: 700; color: var(--color-ink);
        }
        .profile-locked svg { color: var(--color-ink-muted); flex-shrink: 0; }
        .profile-page__fields4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        @media (max-width: 700px) {
          .profile-page__fields3 { grid-template-columns: 1fr 1fr; }
          .profile-page__fields4 { grid-template-columns: 1fr 1fr; }
        }
        .profile-page__options { display: flex; flex-direction: column; gap: 8px; }

        @media (max-width: 480px) {
          .profile-hero { padding: 16px; gap: 14px; }
          .profile-hero__avatar { width: 64px; height: 64px; font-size: 1.35rem; }
          .profile-page__stat strong { font-size: 0.95rem; }
        }
      `}
      </style>
    </div>
  );
}

function LockedField({ label, value }) {
  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <span className="field-label">{label}</span>
      <div className="profile-locked" title="No se puede editar">
        <span>{value}</span>
        <Lock size={14} />
      </div>
    </div>
  );
}

function Metric({ Icon, label, value, unit }) {
  return (
    <div className="profile-metric">
      <Icon size={16} />
      <span>{label}</span>
      <strong>
        {value ?? "—"}
        {value != null && unit ? <small> {unit}</small> : null}
      </strong>
    </div>
  );
}
