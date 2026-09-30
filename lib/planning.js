import planningData from "@/data/planning.json";

// Petits helpers de lecture sur data/planning.json.
// La logique des vues vit dans app/page.js ; ce fichier ne fait
// que centraliser l'acces aux donnees brutes.

export function getChambres() {
  return planningData.chambres;
}

export function getZonesSection() {
  return planningData.zonesSection;
}

export function getZonesCompagnie() {
  return planningData.zonesCompagnie;
}

export function getJours() {
  return planningData.jours;
}

export function getJourByDate(dateStr) {
  return planningData.jours.find((j) => j.date === dateStr) || null;
}

export function getChambreById(id) {
  return planningData.chambres.find((c) => c.id === id) || null;
}
