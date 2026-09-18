import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Camera, TrendingUp, LogOut, Save, Pencil } from "lucide-react";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import LoadingScreen from "../components/LoadingScreen";

const GOAL_OPTIONS = [
  {
    value: "LOSE_WEIGHT",
    label: "Perder Peso",
    subtitle: "Déficit calórico",
    emoji: "🔥",
  },
  {
    value: "MAINTAIN",
    label: "Mantener el Peso",
    subtitle: "Equilibrio calórico",
    emoji: "⚖️",
  },
  {
    value: "GAIN_MUSCLE",
    label: "Ganar Masa Muscular",
    subtitle: "Superávit + proteína",
    emoji: "💪",
  },
  {
    value: "GAIN_WEIGHT",
    label: "Aumentar de Peso",
    subtitle: "Superávit calórico",
    emoji: "📈",
  },
  {
    value: "MODIFY_DIET",
    label: "Modificar Mi Dieta",
    subtitle: "Cambiar hábitos",
    emoji: "🥗",
  },
];

const emptyForm = (profile) => ({
  displayName: profile?.displayName || "",
  weightKg: profile?.weightKg ?? "",
  heightCm: profile?.heightCm ?? "",
  age: profile?.age ?? "",
  goal: profile?.goal ?? "MAINTAIN",
});

const emptyMacroForm = (profile) => ({
  dailyCalorieGoal: profile?.dailyCalorieGoal ?? "",
  dailyProteinGoalG: profile?.dailyProteinGoalG ?? "",
  dailyCarbsGoalG: profile?.dailyCarbsGoalG ?? "",
  dailyFatGoalG: profile?.dailyFatGoalG ?? "",
});

export default function ProfilePage() {
  const { profile, setProfile, logout, firebaseUser } = useAuth();
  const navigate = useNavigate();
  const photoInputRef = useRef(null);

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(() => emptyForm(profile));
  const [macroForm, setMacroForm] = useState(() => emptyMacroForm(profile));
  const [macrosTouched, setMacrosTouched] = useState(false);
  const [pickingGoal, setPickingGoal] = useState(false);

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
    setPickingGoal(false);
    setError(null);
    setSuccess(false);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setPickingGoal(false);
    setError(null);
    setIsEditing(false);
  }

  function updateMacroField(field, value) {
    setMacroForm((m) => ({ ...m, [field]: value }));
    setMacrosTouched(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const payload = {
        displayName: form.displayName,
        weightKg: Number(form.weightKg),
        heightCm: Number(form.heightCm),
        age: Number(form.age),
        goal: form.goal,
      };
      // Solo mandamos las metas de macros si el usuario las tocó a mano
      // en esta edición — si no, dejamos que el backend las recalcule
      // solo a partir de los datos biométricos/objetivo nuevos.
      if (macrosTouched) {
        payload.dailyCalorieGoal = Number(macroForm.dailyCalorieGoal);
        payload.dailyProteinGoalG = Number(macroForm.dailyProteinGoalG);
        payload.dailyCarbsGoalG = Number(macroForm.dailyCarbsGoalG);
        payload.dailyFatGoalG = Number(macroForm.dailyFatGoalG);
      }

      const { data } = await apiClient.patch("/users/me", payload);
      setProfile(data.user);
      setSuccess(true);
      setIsEditing(false);
      setPickingGoal(false);
      const { data: summary } = await apiClient.get("/history/summary");
      setWeightHistory(summary.weightHistory);
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
  const chartData = weightHistory.map((w, i) => ({
    label: `Sem ${i + 1}`,
    peso: w.weightKg,
  }));
  const activeGoal =
    GOAL_OPTIONS.find(
      (g) => g.value === (isEditing ? form.goal : profile?.goal),
    ) || GOAL_OPTIONS.find((g) => g.value === "MAINTAIN");

  return (
    <div className="container profile-page">
      <div className="profile-page__header">
        <div>
          <h1>Mi Perfil</h1>
          <p className="helper-text">Configurá tus datos y objetivos</p>
        </div>
        <div className="profile-page__header-actions">
          {isEditing ? (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleCancelEdit}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveClick}
                disabled={saving}
              >
                <Save size={16} /> {saving ? "Guardando…" : "Guardar Cambios"}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleEnterEdit}
            >
              <Pencil size={16} /> Editar Perfil
            </button>
          )}
          <button
            type="button"
            className="profile-page__logout-btn"
            onClick={() => setShowLogoutConfirm(true)}
          >
            <LogOut size={16} /> Salir
          </button>
        </div>
      </div>

      {error && (
        <p className="field-error" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}
      {success && (
        <p
          className="helper-text"
          style={{
            color: "var(--color-primary)",
            fontWeight: 600,
            marginBottom: 16,
          }}
        >
          Cambios guardados.
        </p>
      )}

      <div className="profile-page__grid">
        {/* Columna izquierda */}
        <div className="profile-page__left">
          <section className="card profile-page__avatar-card">
            <div className="profile-page__avatar-wrap">
              {profile?.photoUrl ? (
                <img
                  src={profile.photoUrl}
                  alt="Tu foto de perfil"
                  className="profile-page__avatar-img"
                />
              ) : (
                <span className="avatar-circle avatar-circle--lg">
                  {initials}
                </span>
              )}
              {isEditing && (
                <button
                  type="button"
                  className="profile-page__avatar-camera"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  aria-label="Cambiar foto de perfil"
                >
                  <Camera size={15} />
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

            {isEditing ? (
              <input
                className="profile-page__name-input"
                value={form.displayName}
                onChange={(e) =>
                  setForm({ ...form, displayName: e.target.value })
                }
                maxLength={100}
                placeholder="Tu nombre"
              />
            ) : (
              <h2>{profile?.displayName || "Sin nombre"}</h2>
            )}
            <p className="helper-text" style={{ margin: 0 }}>
              {firebaseUser?.email}
            </p>

            <div className="profile-page__stats-row">
              <div>
                <p className="profile-page__stat-value">
                  {first != null ? `${first} kg` : "—"}
                </p>
                <p className="helper-text">Peso Inicial</p>
              </div>
              <div>
                <p
                  className="profile-page__stat-value"
                  style={{ color: "var(--color-primary)" }}
                >
                  {delta != null
                    ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} kg`
                    : "—"}
                </p>
                <p className="helper-text">Progreso</p>
              </div>
              <div>
                <p className="profile-page__stat-value">
                  {last != null ? `${last} kg` : "—"}
                </p>
                <p className="helper-text">Peso Actual</p>
              </div>
            </div>
          </section>

          <section className="card profile-page__goal-card">
            <h3>Objetivo Fitness</h3>
            <div className="profile-page__goal-active">
              <span>{activeGoal.emoji}</span>
              <div>
                <p className="profile-page__goal-label">{activeGoal.label}</p>
                <p className="helper-text">{activeGoal.subtitle}</p>
              </div>
            </div>

            {isEditing &&
              (!pickingGoal ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-block"
                  onClick={() => setPickingGoal(true)}
                >
                  Cambiar Objetivo
                </button>
              ) : (
                <div className="profile-page__goal-options">
                  {GOAL_OPTIONS.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      className={`profile-page__goal-option${g.value === form.goal ? " is-active" : ""}`}
                      onClick={() => {
                        setForm({ ...form, goal: g.value });
                        setPickingGoal(false);
                      }}
                    >
                      <span>{g.emoji}</span> {g.label}
                    </button>
                  ))}
                </div>
              ))}
          </section>
        </div>

        {/* Columna derecha */}
        <div className="profile-page__right">
          <section className="card profile-page__metrics-card">
            <h3>Tus Métricas</h3>
            <div className="profile-page__metrics-grid">
              <div className="profile-page__metric">
                <p className="helper-text">Edad</p>
                {isEditing ? (
                  <div className="profile-page__metric-input-row">
                    <input
                      type="number"
                      min="13"
                      max="100"
                      value={form.age}
                      onChange={(e) =>
                        setForm({ ...form, age: e.target.value })
                      }
                    />
                    <span>años</span>
                  </div>
                ) : (
                  <p className="profile-page__metric-value">
                    {profile?.age ?? "—"}{" "}
                    <span className="helper-text">años</span>
                  </p>
                )}
              </div>
              <div className="profile-page__metric">
                <p className="helper-text">Peso</p>
                {isEditing ? (
                  <div className="profile-page__metric-input-row">
                    <input
                      type="number"
                      min="20"
                      max="400"
                      step="0.1"
                      value={form.weightKg}
                      onChange={(e) =>
                        setForm({ ...form, weightKg: e.target.value })
                      }
                    />
                    <span>kg</span>
                  </div>
                ) : (
                  <p className="profile-page__metric-value">
                    {profile?.weightKg ?? "—"}{" "}
                    <span className="helper-text">kg</span>
                  </p>
                )}
              </div>
              <div className="profile-page__metric">
                <p className="helper-text">Altura</p>
                {isEditing ? (
                  <div className="profile-page__metric-input-row">
                    <input
                      type="number"
                      min="80"
                      max="260"
                      value={form.heightCm}
                      onChange={(e) =>
                        setForm({ ...form, heightCm: e.target.value })
                      }
                    />
                    <span>cm</span>
                  </div>
                ) : (
                  <p className="profile-page__metric-value">
                    {profile?.heightCm ?? "—"}{" "}
                    <span className="helper-text">cm</span>
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="card profile-page__chart-card">
            <div className="profile-page__chart-header">
              <div className="profile-page__chart-title">
                <TrendingUp size={18} color="var(--color-primary)" />
                <h3>Evolución de Peso</h3>
              </div>
              {first != null && last != null && (
                <div className="profile-page__chart-stats">
                  <span className="helper-text">
                    Inicio: <strong>{first} kg</strong>
                  </span>
                  <span className="profile-page__chart-delta">
                    {delta >= 0 ? "+" : ""}
                    {delta.toFixed(1)} kg en {chartData.length} semanas
                  </span>
                  <span className="helper-text">
                    Actual: <strong>{last} kg</strong>
                  </span>
                </div>
              )}
            </div>
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 16, left: -16, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-line)"
                  />
                  <XAxis
                    dataKey="label"
                    stroke="var(--color-ink-soft)"
                    fontSize={12}
                  />
                  <YAxis
                    stroke="var(--color-ink-soft)"
                    fontSize={12}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    contentStyle={{
                      fontFamily: "var(--font-body)",
                      borderRadius: 8,
                    }}
                    formatter={(v) => [`${v} kg`, "Peso"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="peso"
                    stroke="var(--color-primary)"
                    strokeWidth={3}
                    dot={{ r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="helper-text">
                Todavía no hay suficientes registros de peso para graficar tu
                progreso. Se suman automáticamente cada vez que guardás un peso
                nuevo acá.
              </p>
            )}
          </section>

          <section className="card profile-page__macros-card">
            <h3>Metas Diarias</h3>
            <p
              className="helper-text"
              style={{ marginTop: -6, marginBottom: 14 }}
            >
              Se calculan solas según tu objetivo, pero las podés ajustar como
              quieras.
            </p>
            <div className="profile-page__macros-grid">
              <div className="profile-page__macro-field">
                <label htmlFor="goalCalories">Calorías</label>
                {isEditing ? (
                  <div className="profile-page__macro-input-row">
                    <input
                      id="goalCalories"
                      type="number"
                      min="500"
                      max="8000"
                      value={macroForm.dailyCalorieGoal}
                      onChange={(e) =>
                        updateMacroField("dailyCalorieGoal", e.target.value)
                      }
                    />
                    <span>kcal</span>
                  </div>
                ) : (
                  <p className="profile-page__macro-value">
                    {profile?.dailyCalorieGoal ?? "—"}{" "}
                    <span className="helper-text">kcal</span>
                  </p>
                )}
              </div>
              <div className="profile-page__macro-field">
                <label htmlFor="goalProtein">Proteínas</label>
                {isEditing ? (
                  <div className="profile-page__macro-input-row">
                    <input
                      id="goalProtein"
                      type="number"
                      min="0"
                      max="500"
                      value={macroForm.dailyProteinGoalG}
                      onChange={(e) =>
                        updateMacroField("dailyProteinGoalG", e.target.value)
                      }
                    />
                    <span>g</span>
                  </div>
                ) : (
                  <p className="profile-page__macro-value">
                    {profile?.dailyProteinGoalG ?? "—"}{" "}
                    <span className="helper-text">g</span>
                  </p>
                )}
              </div>
              <div className="profile-page__macro-field">
                <label htmlFor="goalCarbs">Carbohidratos</label>
                {isEditing ? (
                  <div className="profile-page__macro-input-row">
                    <input
                      id="goalCarbs"
                      type="number"
                      min="0"
                      max="900"
                      value={macroForm.dailyCarbsGoalG}
                      onChange={(e) =>
                        updateMacroField("dailyCarbsGoalG", e.target.value)
                      }
                    />
                    <span>g</span>
                  </div>
                ) : (
                  <p className="profile-page__macro-value">
                    {profile?.dailyCarbsGoalG ?? "—"}{" "}
                    <span className="helper-text">g</span>
                  </p>
                )}
              </div>
              <div className="profile-page__macro-field">
                <label htmlFor="goalFat">Grasas</label>
                {isEditing ? (
                  <div className="profile-page__macro-input-row">
                    <input
                      id="goalFat"
                      type="number"
                      min="0"
                      max="400"
                      value={macroForm.dailyFatGoalG}
                      onChange={(e) =>
                        updateMacroField("dailyFatGoalG", e.target.value)
                      }
                    />
                    <span>g</span>
                  </div>
                ) : (
                  <p className="profile-page__macro-value">
                    {profile?.dailyFatGoalG ?? "—"}{" "}
                    <span className="helper-text">g</span>
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {showGoalChangeConfirm && (
        <div
          className="modal-overlay"
          onClick={() => setShowGoalChangeConfirm(false)}
        >
          <div
            className="modal-panel profile-page__goal-confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="profile-page__goal-confirm-icon">
              <TrendingUp size={26} />
            </div>
            <h3>¿Cambiar de objetivo?</h3>
            <p className="helper-text">
              Tu gráfico de evolución de peso se va a reiniciar: el peso actual
              pasa a ser tu nuevo punto de partida.
            </p>
            <div className="profile-page__goal-confirm-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowGoalChangeConfirm(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmGoalChangeAndSave}
                disabled={saving}
              >
                {saving ? "Guardando…" : "Sí, cambiar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div
          className="modal-overlay"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="modal-panel profile-page__logout-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="profile-page__logout-icon">
              <LogOut size={26} />
            </div>
            <h3>¿Cerrar sesión?</h3>
            <p className="helper-text">
              Vas a salir de tu cuenta. Podés volver a ingresar cuando quieras.
            </p>
            <div className="profile-page__logout-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="profile-page__logout-confirm"
                onClick={handleLogout}
              >
                Sí, salir
              </button>
            </div>
          </div>
        </div>
      )}

      <style>
        {`
        .profile-page { padding: 32px 24px 64px; }
        .profile-page__header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 16px; flex-wrap: wrap; }
        .profile-page__header h1 { margin: 0; }
        .profile-page__header-actions { display: flex; gap: 10px; }
        .profile-page__logout-btn {
          display: inline-flex; align-items: center; gap: 8px; background: transparent; color: var(--color-danger);
          border: 1.5px solid #F3C6C0; padding: 10px 16px; border-radius: var(--radius-md); font-weight: 600; cursor: pointer;
        }
        .profile-page__logout-btn:hover { background: #FBEAE8; }

        .profile-page__grid { display: grid; grid-template-columns: 1fr 2fr; gap: 20px; align-items: start; }
        @media (max-width: 900px) { .profile-page__grid { grid-template-columns: 1fr; } }
        .profile-page__left { display: flex; flex-direction: column; gap: 20px; }
        .profile-page__right { display: flex; flex-direction: column; gap: 20px; }

        .profile-page__avatar-card { padding: 26px; text-align: center; }
        .profile-page__avatar-wrap { position: relative; width: 96px; height: 96px; margin: 0 auto 14px; }
        .profile-page__avatar-wrap .avatar-circle--lg,
        .profile-page__avatar-img { width: 96px; height: 96px; font-size: 1.7rem; }
        .profile-page__avatar-img { border-radius: 50%; object-fit: cover; }
        .profile-page__avatar-camera {
          position: absolute; bottom: 0; right: 0; width: 34px; height: 34px; border-radius: 50%;
          background: var(--color-primary); border: 4px solid var(--color-surface); color: #fff;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .profile-page__avatar-camera:disabled { opacity: 0.6; cursor: not-allowed; }
        .profile-page__avatar-card h2 { margin: 0; font-size: 1.15rem; }
        .profile-page__name-input {
          font-size: 1.1rem; font-weight: 700; text-align: center; border: 1.5px solid var(--color-primary);
          border-radius: var(--radius-sm); padding: 4px 10px; width: 90%;
        }
        .profile-page__stats-row {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 20px; padding-top: 20px;
          border-top: 1px solid var(--color-line);
        }
        .profile-page__stat-value { margin: 0; font-weight: 700; font-size: 1.05rem; }

        .profile-page__goal-card { padding: 24px; }
        .profile-page__goal-card h3 { margin: 0 0 14px; font-size: 1rem; }
        .profile-page__goal-active {
          display: flex; align-items: center; gap: 14px; padding: 14px; background: var(--color-primary-soft);
          border: 2px solid var(--color-primary); border-radius: var(--radius-md); margin-bottom: 12px;
        }
        .profile-page__goal-active span:first-child { font-size: 2rem; }
        .profile-page__goal-label { margin: 0; font-weight: 700; color: var(--color-primary); }
        .profile-page__goal-options { display: flex; flex-direction: column; gap: 8px; }
        .profile-page__goal-option {
          display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: var(--radius-sm);
          border: 1.5px solid var(--color-line); background: var(--color-surface); font-weight: 600; cursor: pointer; text-align: left;
        }
        .profile-page__goal-option.is-active { border-color: var(--color-primary); background: var(--color-primary-soft); }
        .profile-page__goal-option:hover { border-color: var(--color-primary); }

        .profile-page__metrics-card { padding: 24px; }
        .profile-page__metrics-card h3 { margin: 0 0 16px; font-size: 1rem; }
        .profile-page__metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        .profile-page__metric { background: var(--color-bg); border-radius: var(--radius-md); padding: 14px; }
        .profile-page__metric-input-row { display: flex; align-items: baseline; gap: 5px; }
        .profile-page__metric-input-row input {
          width: 100%; background: transparent; border: none; font-size: 1.5rem; font-weight: 700;
          color: var(--color-ink); padding: 2px 0;
        }
        .profile-page__metric-input-row input:focus { outline: 2px solid var(--color-primary); border-radius: 6px; }
        .profile-page__metric-input-row span { color: var(--color-ink-soft); font-size: 0.85rem; }
        .profile-page__metric-value { margin: 0; font-size: 1.5rem; font-weight: 700; }

        .profile-page__chart-card { padding: 24px; }
        .profile-page__chart-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
        .profile-page__chart-title { display: flex; align-items: center; gap: 8px; }
        .profile-page__chart-title h3 { margin: 0; font-size: 1rem; }
        .profile-page__chart-stats { display: flex; gap: 14px; font-size: 0.85rem; }
        .profile-page__chart-delta { color: var(--color-primary); font-weight: 700; }

        .profile-page__macros-card { padding: 24px; }
        .profile-page__macros-card h3 { margin: 0 0 4px; font-size: 1rem; }
        .profile-page__macros-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .profile-page__macro-field { background: var(--color-bg); border-radius: var(--radius-md); padding: 12px 14px; }
        .profile-page__macro-field label { display: block; font-size: 0.72rem; color: var(--color-ink-soft); margin-bottom: 4px; }
        .profile-page__macro-input-row { display: flex; align-items: baseline; gap: 5px; }
        .profile-page__macro-input-row input {
          width: 100%; background: transparent; border: none; font-size: 1.15rem; font-weight: 700;
          color: var(--color-ink); padding: 1px 0;
        }
        .profile-page__macro-input-row input:focus { outline: 2px solid var(--color-primary); border-radius: 6px; }
        .profile-page__macro-input-row span { color: var(--color-ink-soft); font-size: 0.78rem; }
        .profile-page__macro-value { margin: 0; font-size: 1.15rem; font-weight: 700; }
        @media (max-width: 700px) { .profile-page__macros-grid { grid-template-columns: 1fr 1fr; } }

        .profile-page__logout-modal { padding: 30px; text-align: center; }
        .profile-page__logout-icon {
          width: 60px; height: 60px; border-radius: var(--radius-lg); background: #FBEAE8; color: var(--color-danger);
          display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;
        }
        .profile-page__logout-modal h3 { margin: 0 0 8px; }
        .profile-page__logout-actions { display: flex; gap: 10px; margin-top: 20px; }
        .profile-page__logout-actions .btn { flex: 1; }
        .profile-page__logout-confirm {
          flex: 1; background: var(--color-danger); color: #fff; border: none; border-radius: var(--radius-md);
          padding: 12px; font-weight: 700; cursor: pointer;
        }
        .profile-page__logout-confirm:hover { background: #a8362a; }

        .profile-page__goal-confirm-modal { padding: 30px; text-align: center; }
        .profile-page__goal-confirm-icon {
          width: 60px; height: 60px; border-radius: var(--radius-lg); background: var(--color-primary-soft); color: var(--color-primary);
          display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;
        }
        .profile-page__goal-confirm-modal h3 { margin: 0 0 8px; }
        .profile-page__goal-confirm-actions { display: flex; gap: 10px; margin-top: 20px; }
        .profile-page__goal-confirm-actions .btn { flex: 1; }
      `}
      </style>
    </div>
  );
}
