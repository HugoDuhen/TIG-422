"use client";

import { useEffect, useMemo, useState } from "react";
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

const TODAY_ISO = toISODateUTC(new Date());

function defaultDate() {
  return clampDate(TODAY_ISO);
}

// Jeu d'icônes unifié (trait fin, même style) — remplace les emoji, dont le
// rendu varie selon l'OS du visiteur.
const ICON_PROPS = {
  viewBox: "0 0 24 24",
  width: 20,
  height: 20,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const ZONE_ICONS = {
  "Bureau CDS": (
    <svg {...ICON_PROPS}>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" />
      <path d="M10 21v-4h4v4" />
    </svg>
  ),
  Couloirs: (
    <svg {...ICON_PROPS}>
      <rect x="5" y="2" width="12" height="20" rx="1" />
      <circle cx="14.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  ),
  Toilettes: (
    <svg {...ICON_PROPS}>
      <path d="M6 12V5a2 2 0 0 1 2-2h2v9" />
      <path d="M6 12h12v3a5 5 0 0 1-5 5H9a5 5 0 0 1-3-1" />
      <path d="M4 20h16" />
    </svg>
  ),
  SDC: (
    <svg {...ICON_PROPS}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  ),
  Pédiluve: (
    <svg {...ICON_PROPS}>
      <path d="M3 15c1-3 3-4 5-4h8c2 0 4 1 5 4" />
      <path d="M5 15v2a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2" />
      <path d="M8 11c0-2 1-3 2-3M14 11c0-2 1-3 2-3" />
    </svg>
  ),
  Douche: (
    <svg {...ICON_PROPS}>
      <path d="M6 3h12" />
      <path d="M8 3v2a4 4 0 0 0 8 0V3" />
      <path d="M12 9v3" />
      <path d="M8 20c0-3 2-5 4-5s4 2 4 5" />
      <path d="M6 20h12" />
    </svg>
  ),
  "Escaliers (+ hall)": (
    <svg {...ICON_PROPS}>
      <path d="M3 21h4v-4h4v-4h4v-4h4V5" />
    </svg>
  ),
};

const DEFAULT_ICON = (
  <svg {...ICON_PROPS}>
    <circle cx="12" cy="12" r="8" />
  </svg>
);

function ZoneIcon({ zone }) {
  return <span className="icon-circle">{ZONE_ICONS[zone] ?? DEFAULT_ICON}</span>;
}

function MoonIcon(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
    </svg>
  );
}

function SunIcon(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function ChevronRightIcon(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function groupByZone(entries) {
  const map = {};
  for (const entry of entries) {
    if (!map[entry.zone]) map[entry.zone] = [];
    map[entry.zone].push(entry);
  }
  return map;
}

function useTheme() {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    let initial = "light";
    try {
      const stored = localStorage.getItem("theme");
      initial =
        stored || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    } catch {
      // ignore (stockage indisponible)
    }
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  const toggle = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem("theme", next);
      } catch {
        // ignore
      }
      return next;
    });
  };

  return { theme, toggle };
}

// Ligne de navigation (flèches + contenu central) qui ne se casse jamais sur
// mobile : les flèches restent sur la même ligne, seul le contenu central
// peut rétrécir.
function NavRow({ onPrev, onNext, prevDisabled, nextDisabled, children }) {
  return (
    <div className="date-nav">
      <div className="date-nav-row">
        <button
          type="button"
          className="date-nav-arrow"
          onClick={onPrev}
          disabled={prevDisabled}
          aria-label="Précédent"
        >
          ←
        </button>
        <div className="date-center">{children}</div>
        <button
          type="button"
          className="date-nav-arrow"
          onClick={onNext}
          disabled={nextDisabled}
          aria-label="Suivant"
        >
          →
        </button>
      </div>
    </div>
  );
}

// Tableau avec première colonne figée au scroll horizontal + indice visuel
// (dégradé + texte) pour les écrans étroits.
function TableScroll({ title, children }) {
  return (
    <div className="table-wrap">
      <h2>{title}</h2>
      <div className="table-scroll">
        {children}
        <div className="scroll-fade" />
      </div>
      <div className="scroll-hint">
        <ChevronRightIcon width={14} height={14} />
        Glisser pour voir plus de colonnes
      </div>
    </div>
  );
}

// Quand une zone a plusieurs élèves le même jour (ex. "SDC" x2), chacun
// reçoit sa propre petite case plutôt que d'être fondu dans un texte unique.
function NameChips({ names, category }) {
  if (!names || names.length === 0) return "—";
  return (
    <div className="name-chips">
      {names.map((name, i) => (
        <span
          className={`name-chip ${name === "423" ? "autre" : category}`}
          key={`${name}-${i}`}
        >
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
  const { theme, toggle } = useTheme();

  return (
    <div className="page">
      <header className="app-header">
        <div className="brand">
          <div className="brand-badge">422</div>
          <div>
            <h1>Planning TIG</h1>
            <p className="brand-subtitle">395<sup>e</sup> promotion · 4<sup>e</sup> bataillon</p>
          </div>
        </div>
        <button
          type="button"
          className="theme-toggle"
          onClick={toggle}
          aria-label="Changer de thème"
        >
          {theme === "dark" ? <SunIcon width={18} height={18} /> : <MoonIcon width={18} height={18} />}
        </button>
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
        <div className="motif-banner">
          <MoonIcon width={18} height={18} />
          Pas de TIG — {jour.motif}
        </div>
      ) : (
        <div className="jour-grid">
          <PosteCards title="TIG section" entries={jour.section} category="section" />
          <PosteCards
            title={
              jour.lettre ? `TIG compagnie — Jour ${jour.lettre}` : "TIG compagnie"
            }
            entries={jour.compagnie}
            category="compagnie"
          />
        </div>
      )}
    </section>
  );
}

function DateNav({ selectedDate, onChangeDate }) {
  const jour = JOURS_BY_DATE.get(selectedDate);
  return (
    <NavRow
      onPrev={() => onChangeDate(clampDate(addDaysISO(selectedDate, -1)))}
      onNext={() => onChangeDate(clampDate(addDaysISO(selectedDate, 1)))}
      prevDisabled={selectedDate <= MIN_DATE}
      nextDisabled={selectedDate >= MAX_DATE}
    >
      <input
        type="date"
        value={selectedDate}
        min={MIN_DATE}
        max={MAX_DATE}
        onChange={(e) => e.target.value && onChangeDate(e.target.value)}
      />
      <div className="date-nav-label">{formatDateLong(selectedDate)}</div>
      {(jour?.lettre || selectedDate === TODAY_ISO) && (
        <div className="badge-row">
          {selectedDate === TODAY_ISO && <span className="today-badge">Aujourd&apos;hui</span>}
          {jour?.lettre && (
            <div className="letter-badge">
              <span className="dot" />
              Jour {jour.lettre}
            </div>
          )}
        </div>
      )}
    </NavRow>
  );
}

function PosteCards({ title, entries, category }) {
  const grouped = groupByZone(entries);
  const zones = Object.keys(grouped);
  return (
    <div className="poste-group">
      <div className={`group-head ${category}`}>
        <div className="bar" />
        <h2 className="poste-group-title">{title}</h2>
        <div className="count">{entries.length} postes</div>
      </div>
      <div className="poste-cards">
        {zones.map((zone) => {
          const isAutre = grouped[zone].every((e) => e.eleve === "423");
          const cardCategory = isAutre ? "autre" : category;
          return (
            <div className={`poste-card ${cardCategory}`} key={zone}>
              <ZoneIcon zone={zone} />
              <div className="card-body">
                <div className="poste-card-zone">{zone}</div>
                {grouped[zone].map((entry, i) => (
                  <div className="poste-card-eleve-row" key={`${entry.eleve}-${i}`}>
                    <div className="poste-card-eleve">{entry.eleve}</div>
                    <div className="poste-card-chambre">{entry.chambre}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
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
      <NavRow
        onPrev={() => onChangeDate(clampDate(addDaysISO(selectedDate, -7)))}
        onNext={() => onChangeDate(clampDate(addDaysISO(selectedDate, 7)))}
        prevDisabled={monday <= MIN_DATE}
        nextDisabled={addDaysISO(monday, 7) > MAX_DATE}
      >
        <div className="date-nav-label">Semaine du {formatDateShort(monday)}</div>
      </NavRow>

      <SemaineTable title="TIG section" zones={ZONES_SECTION} dates={weekDates} field="section" category="section" />
      <SemaineTable
        title="TIG compagnie"
        zones={ZONES_COMPAGNIE}
        dates={weekDates}
        field="compagnie"
        category="compagnie"
      />
    </section>
  );
}

function SemaineTable({ title, zones, dates, field, category }) {
  return (
    <TableScroll title={title}>
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
                    <NameChips names={names} category={category} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
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
      <NavRow
        onPrev={() => canPrev && onChangeMonth(MOIS_DISPONIBLES[idx - 1].key)}
        onNext={() => canNext && onChangeMonth(MOIS_DISPONIBLES[idx + 1].key)}
        prevDisabled={!canPrev}
        nextDisabled={!canNext}
      >
        <div className="date-nav-label">
          {MOIS_FR_LONG[current.month].charAt(0).toUpperCase() +
            MOIS_FR_LONG[current.month].slice(1)}{" "}
          {current.year}
        </div>
      </NavRow>

      <MoisTable title="TIG section" zones={ZONES_SECTION} dates={monthDates} field="section" category="section" />
      <MoisTable
        title="TIG compagnie"
        zones={ZONES_COMPAGNIE}
        dates={monthDates}
        field="compagnie"
        category="compagnie"
      />
    </section>
  );
}

function MoisTable({ title, zones, dates, field, category }) {
  return (
    <TableScroll title={title}>
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
                    <NameChips
                      names={(grouped[zone] || []).map((e) => e.eleve)}
                      category={category}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableScroll>
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
        <div className="motif-banner">
          <MoonIcon width={18} height={18} />
          Pas de TIG — {jour.motif}
        </div>
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
      <TableScroll title="Récapitulatif par élève">
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
      </TableScroll>
    </section>
  );
}
