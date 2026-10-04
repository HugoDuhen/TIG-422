"use client";

import { useMemo, useState } from "react";
import planningData from "@/data/planning.json";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const TABS = [
  { id: "jour", label: "Jour" },
  { id: "semaine", label: "Semaine" },
  { id: "mois", label: "Mois" },
  { id: "chambre", label: "Par chambre" },
  { id: "recap", label: "Récap" },
];

const JOURS_FR_LONG = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
];
const JOURS_FR_ABBR = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MOIS_FR_LONG = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];
const MOIS_FR_ABBR = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

// ---------------------------------------------------------------------------
// Utilitaires de dates, en UTC explicite pour éviter tout décalage de
// fuseau horaire (jamais de Date locale / toISOString() implicite).
// ---------------------------------------------------------------------------

function pad2(n) {
  return String(n).padStart(2, "0");
}

function parseISODateUTC(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toISODateUTC(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
    date.getUTCDate()
  )}`;
}

function addDaysISO(str, n) {
  const d = parseISODateUTC(str);
  d.setUTCDate(d.getUTCDate() + n);
  return toISODateUTC(d);
}

function getWeekdayUTC(str) {
  return parseISODateUTC(str).getUTCDay(); // 0 = dimanche .. 6 = samedi
}

function getMondayISO(str) {
  const wd = getWeekdayUTC(str);
  const diff = wd === 0 ? -6 : 1 - wd;
  return addDaysISO(str, diff);
}

function formatDateLong(str) {
  const d = parseISODateUTC(str);
  const wd = JOURS_FR_LONG[d.getUTCDay()];
  const mo = MOIS_FR_LONG[d.getUTCMonth()];
  const label = `${wd} ${d.getUTCDate()} ${mo} ${d.getUTCFullYear()}`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatDateShort(str) {
  const d = parseISODateUTC(str);
  const wd = JOURS_FR_ABBR[d.getUTCDay()];
  const mo = MOIS_FR_ABBR[d.getUTCMonth()];
  return `${wd} ${d.getUTCDate()} ${mo}`;
}

function formatDayNumber(str) {
  const d = parseISODateUTC(str);
  return d.getUTCDate();
}

function monthKey(str) {
  return str.slice(0, 7); // YYYY-MM
}

// ---------------------------------------------------------------------------
// Données dérivées de data/planning.json
// ---------------------------------------------------------------------------

const JOURS = planningData.jours;
const CHAMBRES = planningData.chambres;
const ZONES_SECTION = planningData.zonesSection;
const ZONES_COMPAGNIE = planningData.zonesCompagnie;

// Certaines zones portent le même nom en section et en compagnie
// (ex. "Toilettes", "Couloirs") : on les distingue par catégorie pour
// que le récap ne mélange pas les deux compteurs.
const RECAP_COLUMNS = [
  ...ZONES_SECTION.map((zone) => ({
    key: `section:${zone}`,
    label: `${zone} (section)`,
    category: "section",
    zone,
  })),
  ...ZONES_COMPAGNIE.map((zone) => ({
    key: `compagnie:${zone}`,
    label: `${zone} (compagnie)`,
    category: "compagnie",
    zone,
  })),
];

const MIN_DATE = JOURS[0].date;
const MAX_DATE = JOURS[JOURS.length - 1].date;

const JOURS_BY_DATE = new Map(JOURS.map((j) => [j.date, j]));

const CHAMBRE_BY_ELEVE = new Map();
for (const ch of CHAMBRES) {
  for (const e of ch.eleves) CHAMBRE_BY_ELEVE.set(e, ch.id);
}

const MOIS_DISPONIBLES = (() => {
  const seen = new Map();
  for (const j of JOURS) {
    const key = monthKey(j.date);
    if (!seen.has(key)) {
      const d = parseISODateUTC(j.date);
      seen.set(key, { key, year: d.getUTCFullYear(), month: d.getUTCMonth() });
    }
  }
  return Array.from(seen.values());
})();

function clampDate(str) {
  if (str < MIN_DATE) return MIN_DATE;
  if (str > MAX_DATE) return MAX_DATE;
  return str;
}

function defaultDate() {
  const today = toISODateUTC(new Date());
  return clampDate(today);
}

function groupByZone(entries) {
  const map = {};
  for (const entry of entries) {
    if (!map[entry.zone]) map[entry.zone] = [];
    map[entry.zone].push(entry);
  }
  return map;
}

// Quand une zone a plusieurs élèves le même jour (ex. "SDC" x2), chacun
// reçoit sa propre petite case plutôt que d'être fondu dans un texte unique.
function NameChips({ names }) {
  if (!names || names.length === 0) return "—";
  return (
    <div className="name-chips">
      {names.map((name, i) => (
        <span className="name-chip" key={`${name}-${i}`}>
          {name}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export default function Page() {
  const [activeTab, setActiveTab] = useState("jour");
  const [selectedDate, setSelectedDate] = useState(defaultDate());
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const d = defaultDate();
    return monthKey(d);
  });

  return (
    <div className="page">
      <header className="app-header">
        <h1>Planning TIG · 422</h1>
        <nav className="tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tab${activeTab === tab.id ? " tab--active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="app-main">
        {activeTab === "jour" && (
          <VueJour selectedDate={selectedDate} onChangeDate={setSelectedDate} />
        )}
        {activeTab === "semaine" && (
          <VueSemaine
            selectedDate={selectedDate}
            onChangeDate={setSelectedDate}
          />
        )}
        {activeTab === "mois" && (
          <VueMois visibleMonth={visibleMonth} onChangeMonth={setVisibleMonth} />
        )}
        {activeTab === "chambre" && (
          <VueChambre
            selectedDate={selectedDate}
            onChangeDate={setSelectedDate}
          />
        )}
        {activeTab === "recap" && <VueRecap />}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vue Jour
// ---------------------------------------------------------------------------

function VueJour({ selectedDate, onChangeDate }) {
  const jour = JOURS_BY_DATE.get(selectedDate);

  return (
    <section>
      <DateNav selectedDate={selectedDate} onChangeDate={onChangeDate} />

      {!jour ? (
        <p>Aucune donnée pour cette date.</p>
      ) : !jour.tig ? (
        <p className="motif-banner">Pas de TIG — {jour.motif}</p>
      ) : (
        <div className="jour-grid">
          <PosteCards title="TIG section" entries={jour.section} />
          <PosteCards
            title={
              jour.lettre ? `TIG compagnie — Jour ${jour.lettre}` : "TIG compagnie"
            }
            entries={jour.compagnie}
          />
        </div>
      )}
    </section>
  );
}

function DateNav({ selectedDate, onChangeDate }) {
  return (
    <div className="date-nav">
      <button
        type="button"
        className="date-nav-arrow"
        onClick={() => onChangeDate(clampDate(addDaysISO(selectedDate, -1)))}
        aria-label="Jour précédent"
      >
        ←
      </button>
      <input
        type="date"
        value={selectedDate}
        min={MIN_DATE}
        max={MAX_DATE}
        onChange={(e) => e.target.value && onChangeDate(e.target.value)}
      />
      <button
        type="button"
        className="date-nav-arrow"
        onClick={() => onChangeDate(clampDate(addDaysISO(selectedDate, 1)))}
        aria-label="Jour suivant"
      >
        →
      </button>
      <span className="date-nav-label">{formatDateLong(selectedDate)}</span>
    </div>
  );
}

function PosteCards({ title, entries }) {
  const grouped = groupByZone(entries);
  const zones = Object.keys(grouped);
  return (
    <div className="poste-group">
      <h2 className="poste-group-title">{title}</h2>
      <div className="poste-cards">
        {zones.map((zone) => (
          <div className="poste-card" key={zone}>
            <div className="poste-card-zone">{zone}</div>
            {grouped[zone].map((entry, i) => (
              <div className="poste-card-eleve-row" key={`${entry.eleve}-${i}`}>
                <div className="poste-card-eleve">{entry.eleve}</div>
                <div className="poste-card-chambre">{entry.chambre}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vue Semaine
// ---------------------------------------------------------------------------

function VueSemaine({ selectedDate, onChangeDate }) {
  const monday = getMondayISO(selectedDate);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDaysISO(monday, i)).filter(
    (d) => JOURS_BY_DATE.has(d)
  );

  return (
    <section>
      <div className="date-nav">
        <button
          type="button"
          onClick={() => onChangeDate(clampDate(addDaysISO(selectedDate, -7)))}
        >
          ← Semaine préc.
        </button>
        <span className="date-nav-label">
          Semaine du {formatDateShort(monday)}
        </span>
        <button
          type="button"
          onClick={() => onChangeDate(clampDate(addDaysISO(selectedDate, 7)))}
        >
          Semaine suiv. →
        </button>
      </div>

      <SemaineTable title="TIG section" zones={ZONES_SECTION} dates={weekDates} field="section" />
      <SemaineTable
        title="TIG compagnie"
        zones={ZONES_COMPAGNIE}
        dates={weekDates}
        field="compagnie"
      />
    </section>
  );
}

function SemaineTable({ title, zones, dates, field }) {
  return (
    <div className="table-wrap">
      <h2>{title}</h2>
      <table>
        <thead>
          <tr>
            <th>Zone</th>
            {dates.map((date) => {
              const jour = JOURS_BY_DATE.get(date);
              return (
                <th key={date}>
                  <div>{formatDateShort(date)}</div>
                  {!jour.tig && <div className="motif-cell">{jour.motif}</div>}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {zones.map((zone) => (
            <tr key={zone}>
              <td>{zone}</td>
              {dates.map((date) => {
                const jour = JOURS_BY_DATE.get(date);
                if (!jour.tig) return <td key={date}>—</td>;
                const grouped = groupByZone(jour[field]);
                const names = (grouped[zone] || []).map((e) => e.eleve);
                return (
                  <td key={date}>
                    <NameChips names={names} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vue Mois
// ---------------------------------------------------------------------------

function VueMois({ visibleMonth, onChangeMonth }) {
  const idx = MOIS_DISPONIBLES.findIndex((m) => m.key === visibleMonth);
  const current = MOIS_DISPONIBLES[idx] ?? MOIS_DISPONIBLES[0];
  const monthDates = JOURS.filter((j) => monthKey(j.date) === current.key).map(
    (j) => j.date
  );

  const canPrev = idx > 0;
  const canNext = idx < MOIS_DISPONIBLES.length - 1;

  return (
    <section>
      <div className="date-nav">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => canPrev && onChangeMonth(MOIS_DISPONIBLES[idx - 1].key)}
        >
          ← Mois préc.
        </button>
        <span className="date-nav-label">
          {MOIS_FR_LONG[current.month].charAt(0).toUpperCase() +
            MOIS_FR_LONG[current.month].slice(1)}{" "}
          {current.year}
        </span>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => canNext && onChangeMonth(MOIS_DISPONIBLES[idx + 1].key)}
        >
          Mois suiv. →
        </button>
      </div>

      <MoisTable title="TIG section" zones={ZONES_SECTION} dates={monthDates} field="section" />
      <MoisTable
        title="TIG compagnie"
        zones={ZONES_COMPAGNIE}
        dates={monthDates}
        field="compagnie"
      />
    </section>
  );
}

function MoisTable({ title, zones, dates, field }) {
  return (
    <div className="table-wrap">
      <h2>{title}</h2>
      <table>
        <thead>
          <tr>
            <th>Jour</th>
            {zones.map((zone) => (
              <th key={zone}>{zone}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dates.map((date) => {
            const jour = JOURS_BY_DATE.get(date);
            if (!jour.tig) {
              return (
                <tr key={date} className="row-off">
                  <td>{formatDateShort(date)}</td>
                  <td colSpan={zones.length} className="motif-cell">
                    {jour.motif}
                  </td>
                </tr>
              );
            }
            const grouped = groupByZone(jour[field]);
            return (
              <tr key={date}>
                <td>{formatDateShort(date)}</td>
                {zones.map((zone) => (
                  <td key={zone}>
                    <NameChips names={(grouped[zone] || []).map((e) => e.eleve)} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vue Par chambre
// ---------------------------------------------------------------------------

function VueChambre({ selectedDate, onChangeDate }) {
  const jour = JOURS_BY_DATE.get(selectedDate);

  const taskByEleve = useMemo(() => {
    const map = new Map();
    if (jour && jour.tig) {
      for (const entry of jour.section) {
        map.set(entry.eleve, { zone: entry.zone, type: "section" });
      }
      for (const entry of jour.compagnie) {
        map.set(entry.eleve, { zone: entry.zone, type: "compagnie" });
      }
    }
    return map;
  }, [jour]);

  return (
    <section>
      <DateNav selectedDate={selectedDate} onChangeDate={onChangeDate} />

      {!jour.tig && (
        <p className="motif-banner">Pas de TIG — {jour.motif}</p>
      )}

      <div className="legend">
        <span className="legend-item">
          <span className="legend-swatch legend-swatch--section" /> TIG section
        </span>
        <span className="legend-item">
          <span className="legend-swatch legend-swatch--compagnie" /> TIG compagnie
        </span>
      </div>

      <div className="chambre-grid">
        {CHAMBRES.map((chambre) => (
          <div key={chambre.id} className="chambre-card">
            <h2>
              {chambre.id} <span className="cdc">(CdC : {chambre.cdc})</span>
            </h2>
            <ul>
              {chambre.eleves.map((eleve) => {
                const task = taskByEleve.get(eleve);
                return (
                  <li
                    key={eleve}
                    className={
                      task
                        ? `eleve-row eleve-row--${task.type}`
                        : "eleve-row"
                    }
                  >
                    <span>{eleve}</span>
                    <span className="task">{task ? task.zone : "Libre"}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Vue Récap
// ---------------------------------------------------------------------------

function VueRecap() {
  const rows = useMemo(() => {
    const counts = new Map();
    for (const ch of CHAMBRES) {
      for (const eleve of ch.eleves) {
        counts.set(eleve, {
          eleve,
          chambre: ch.id,
          postes: Object.fromEntries(RECAP_COLUMNS.map((c) => [c.key, 0])),
          total: 0,
        });
      }
    }

    for (const jour of JOURS) {
      if (!jour.tig) continue;
      for (const entry of jour.section) {
        const row = counts.get(entry.eleve);
        if (!row) continue;
        row.postes[`section:${entry.zone}`] += 1;
        row.total += 1;
      }
      for (const entry of jour.compagnie) {
        const row = counts.get(entry.eleve);
        if (!row) continue;
        row.postes[`compagnie:${entry.zone}`] += 1;
        row.total += 1;
      }
    }

    return Array.from(counts.values()).sort((a, b) =>
      a.eleve.localeCompare(b.eleve, "fr")
    );
  }, []);

  return (
    <section>
      <div className="table-wrap">
        <h2>Récapitulatif par élève</h2>
        <table>
          <thead>
            <tr>
              <th>Élève</th>
              <th>Chambre</th>
              {RECAP_COLUMNS.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.eleve}>
                <td>{row.eleve}</td>
                <td>{row.chambre}</td>
                {RECAP_COLUMNS.map((c) => (
                  <td key={c.key}>{row.postes[c.key]}</td>
                ))}
                <td className="total-cell">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
