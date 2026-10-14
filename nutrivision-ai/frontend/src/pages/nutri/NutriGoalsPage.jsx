import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, TrendingUp } from 'lucide-react';
import apiClient from '../../api/client';
import LoadingScreen from '../../components/LoadingScreen';
import { BackButton, useConfirm } from '../../components/roles';
import { Message, NumberField, OptionCard, PageTitle, SectionHeader } from '../../components/ui';
import { GOAL_OPTIONS } from '../../constants/profile';

const MACROS = [
  { key: 'dailyCalorieGoal', label: 'Calorías', unit: 'kcal', min: 500, max: 8000 },
  { key: 'dailyProteinGoalG', label: 'Proteínas', unit: 'g', min: 0, max: 500 },
  { key: 'dailyCarbsGoalG', label: 'Carbohidratos', unit: 'g', min: 0, max: 900 },
  { key: 'dailyFatGoalG', label: 'Grasas', unit: 'g', min: 0, max: 400 },
];

/**
 * El nutricionista edita el objetivo y las metas diarias del paciente.
 * Mismas reglas que cuando las cambia el paciente: si cambia el objetivo y no se
 * tocan los números, las metas se recalculan solas; los números escritos a mano
 * tienen prioridad. El paciente ve un aviso una sola vez.
 */
export default function NutriGoalsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [form, setForm] = useState(null);
  const [macrosTouched, setMacrosTouched] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [ask, confirmModal] = useConfirm();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await apiClient.get(`/nutritionist/patients/${id}`);
        const p = data.patient;
        setPatient(p);
        setForm({
          goal: p.goal,
          ...Object.fromEntries(MACROS.map(({ key }) => [key, p[key] != null ? String(p[key]) : ''])),
        });
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [id]);

  const update = (key, value) => { setForm((f) => ({ ...f, [key]: value })); setError(null); };
  const updateMacro = (key, value) => { update(key, value); setMacrosTouched(true); };

  function buildPayload() {
    if (macrosTouched) {
      for (const { key, label, min, max } of MACROS) {
        const n = Number(form[key]);
        if (form[key] === '' || !Number.isInteger(n) || n < min || n > max) {
          return { problem: `${label}: tiene que ser un número entero entre ${min} y ${max}.` };
        }
      }
    }
    const payload = {};
    if (form.goal && form.goal !== patient.goal) payload.goal = form.goal;
    if (macrosTouched) {
      MACROS.forEach(({ key }) => {
        const n = Number(form[key]);
        if (n !== patient[key]) payload[key] = n;
      });
    }
    return { payload };
  }

  async function send(payload) {
    setSaving(true);
    try {
      await apiClient.patch(`/nutritionist/patients/${id}/goals`, payload);
      navigate(`/nutri/pacientes/${id}`, { replace: true });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  function save() {
    const { problem, payload } = buildPayload();
    if (problem) { setError(problem); return; }
    if (!Object.keys(payload).length) { setError('No cambiaste nada.'); return; }
    if (payload.goal) {
      ask({
        title: 'Cambiar objetivo',
        message: `Al cambiar el objetivo, el gráfico de peso de ${patient.name.split(' ')[0]} arranca de nuevo desde su peso actual${macrosTouched ? '' : ' y las metas se recalculan solas'}.`,
        confirmLabel: 'Cambiar',
        icon: <TrendingUp size={26} />,
        onConfirm: () => send(payload),
      });
      return;
    }
    send(payload);
  }

  if (!form && !error) return <LoadingScreen label="Cargando…" />;

  return (
    <div className="page page--narrow">
      <PageTitle
        title="Objetivo y metas"
        subtitle={patient ? `Paciente: ${patient.name}. Va a ver un aviso en su app con las metas nuevas.` : undefined}
        back={<BackButton fallback={`/nutri/pacientes/${id}`} />}
      />
      {form ? (
        <>
          <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SectionHeader title="Objetivo" />
            {GOAL_OPTIONS.map((o) => (
              <OptionCard key={o.value} option={o} compact active={form.goal === o.value} onSelect={() => update('goal', o.value)} />
            ))}
          </section>

          <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SectionHeader title="Metas diarias" />
            <p className="hint" style={{ marginTop: -6 }}>
              {macrosTouched
                ? 'Se van a usar estos valores: tienen prioridad sobre el cálculo automático.'
                : 'Si cambiás el objetivo y no tocás estos números, se recalculan solos con los datos del paciente.'}
            </p>
            <div className="nutri-goals__grid">
              {MACROS.map(({ key, label, unit, min, max }) => (
                <NumberField key={key} id={key} label={label} unit={unit} min={min} max={max} value={form[key]} onChange={(v) => updateMacro(key, v)} />
              ))}
            </div>
          </section>
        </>
      ) : null}

      {error ? <Message>{error}</Message> : null}
      {form ? (
        <button type="button" className="btn btn-primary btn-block" onClick={save} disabled={saving}>
          <Save size={17} /> {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      ) : null}

      {confirmModal}
      <style>{`
        .nutri-goals__grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        @media (max-width: 700px) { .nutri-goals__grid { grid-template-columns: 1fr 1fr; } }
      `}</style>
    </div>
  );
}
