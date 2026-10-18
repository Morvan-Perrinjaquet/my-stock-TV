// ============================================================
//  Stock Vêtements — la logique de l'application
// ============================================================

// ----- Les données (enregistrées dans la tablette) -----

// Nom sous lequel les données sont rangées dans le navigateur
const CLE_STOCKAGE = "stockVetements";

// Toutes les données de l'app :
// - articles : la liste des vêtements { id, nom, genre, taille, stock }
//   (genre = "Homme" ou "Femme")
// - mouvements : l'historique des entrées et sorties (utilisé plus tard)
// - prochainNumero : sert à créer le prochain identifiant (VET-0001, VET-0002…)
// - derniereSauvegarde : la date de la dernière sauvegarde (vide si jamais sauvegardé)
let donnees = chargerDonnees();

// Lit les données enregistrées. S'il n'y a rien (première utilisation), on part de zéro.
function chargerDonnees() {
  const texte = localStorage.getItem(CLE_STOCKAGE);
  if (texte) {
    return JSON.parse(texte);
  }
  return { articles: [], mouvements: [], prochainNumero: 1 };
}

// Enregistre les données dans la tablette (à appeler après chaque changement)
function enregistrerDonnees() {
  localStorage.setItem(CLE_STOCKAGE, JSON.stringify(donnees));
}

// Crée un identifiant unique, par exemple "VET-0007". C'est ce qu'il y aura dans le QR code.
function nouvelIdentifiant() {
  const id = "VET-" + String(donnees.prochainNumero).padStart(4, "0");
  donnees.prochainNumero++;
  return id;
}

// ----- Navigation entre les onglets -----

// On récupère tous les boutons d'onglet et toutes les pages
const boutonsOnglets = document.querySelectorAll(".onglet");
const pages = document.querySelectorAll(".page");

// Affiche la page demandée et cache les autres
function afficherOnglet(nom) {
  boutonsOnglets.forEach((bouton) => {
    bouton.classList.toggle("actif", bouton.dataset.onglet === nom);
  });
  pages.forEach((page) => {
    page.classList.toggle("visible", page.id === nom);
  });
  // Le stock a pu changer depuis la dernière fois : on rafraîchit le tableau
  if (nom === "stock") afficherStock();
  // On éteint la caméra quand on quitte l'onglet Scanner
  if (nom !== "scanner") eteindreCamera();
}

// Quand on clique sur un onglet, on affiche sa page
boutonsOnglets.forEach((bouton) => {
  bouton.addEventListener("click", () => afficherOnglet(bouton.dataset.onglet));
});

// ----- Onglet « Vêtements » : ajouter, modifier, supprimer -----

const formulaire = document.getElementById("formulaire-vetement");
const champNom = document.getElementById("champ-nom");
const champGenre = document.getElementById("champ-genre");
const champTaille = document.getElementById("champ-taille");
const champStock = document.getElementById("champ-stock");
const titreFormulaire = document.getElementById("titre-formulaire");
const boutonEnregistrer = document.getElementById("bouton-enregistrer");
const boutonAnnuler = document.getElementById("bouton-annuler");
const messageFormulaire = document.getElementById("message-formulaire");
const listeVetements = document.getElementById("liste-vetements");
const listeVide = document.getElementById("liste-vide");

// Identifiant du vêtement en cours de modification (null = on est en train d'en ajouter un)
let idEnModification = null;

// Affiche un petit message sous le formulaire (vert si tout va bien, rouge si erreur)
function afficherMessage(texte, estErreur) {
  messageFormulaire.textContent = texte;
  messageFormulaire.classList.toggle("erreur", estErreur);
}

// Le nom complet d'un vêtement, par exemple « Veste — Homme — taille M »
function nomComplet(nom, genre, taille) {
  return nom + " — " + genre + " — taille " + taille;
}

// Sert à trier les vêtements : d'abord par nom, puis homme/femme, puis taille
// (numeric: true pour que la taille 38 passe avant la taille 140)
function comparerArticles(a, b) {
  return a.nom.localeCompare(b.nom, "fr") ||
         a.genre.localeCompare(b.genre, "fr") ||
         a.taille.localeCompare(b.taille, "fr", { numeric: true });
}

// Remplit la liste des vêtements à partir des données
function afficherVetements() {
  listeVetements.innerHTML = "";
  listeVide.hidden = donnees.articles.length > 0;

  const articlesTries = [...donnees.articles].sort(comparerArticles);

  articlesTries.forEach((article) => {
    const ligne = document.createElement("li");

    const infos = document.createElement("div");
    infos.className = "infos";
    const nom = document.createElement("strong");
    nom.textContent = nomComplet(article.nom, article.genre, article.taille);
    const details = document.createElement("span");
    details.className = "details";
    details.textContent = article.stock + " en stock · " + article.id;
    infos.append(nom, details);

    const boutonEtiquette = document.createElement("button");
    boutonEtiquette.className = "bouton bouton-secondaire";
    boutonEtiquette.textContent = "🖨️ Étiquette";
    boutonEtiquette.addEventListener("click", () => afficherEtiquettes([article]));

    const boutonModifier = document.createElement("button");
    boutonModifier.className = "bouton bouton-secondaire";
    boutonModifier.textContent = "Modifier";
    boutonModifier.addEventListener("click", () => commencerModification(article.id));

    const boutonSupprimer = document.createElement("button");
    boutonSupprimer.className = "bouton bouton-danger";
    boutonSupprimer.textContent = "Supprimer";
    boutonSupprimer.addEventListener("click", () => supprimerVetement(article.id));

    ligne.append(infos, boutonEtiquette, boutonModifier, boutonSupprimer);
    listeVetements.append(ligne);
  });

  // La liste de l'onglet Scanner doit suivre les mêmes vêtements
  remplirChoixVetement();
}

// Remet le formulaire à zéro, en mode « Ajouter »
function viderFormulaire() {
  idEnModification = null;
  formulaire.reset();
  titreFormulaire.textContent = "Ajouter un vêtement";
  boutonEnregistrer.textContent = "Ajouter";
  boutonAnnuler.hidden = true;
}

// Remplit le formulaire avec un vêtement existant pour le modifier
function commencerModification(id) {
  const article = donnees.articles.find((a) => a.id === id);
  idEnModification = id;
  champNom.value = article.nom;
  champGenre.value = article.genre;
  champTaille.value = article.taille;
  champStock.value = article.stock;
  titreFormulaire.textContent = "Modifier « " + nomComplet(article.nom, article.genre, article.taille) + " »";
  boutonEnregistrer.textContent = "Enregistrer";
  boutonAnnuler.hidden = false;
  afficherMessage("", false);
  champNom.focus();
}

// Supprime un vêtement après confirmation
function supprimerVetement(id) {
  const article = donnees.articles.find((a) => a.id === id);
  const ok = confirm("Supprimer « " + nomComplet(article.nom, article.genre, article.taille) + " » ?\nSon étiquette QR code ne marchera plus.");
  if (!ok) return;

  donnees.articles = donnees.articles.filter((a) => a.id !== id);
  enregistrerDonnees();
  if (idEnModification === id) viderFormulaire();
  afficherMessage("Vêtement supprimé.", false);
  afficherVetements();
}

// Quand on valide le formulaire : on ajoute ou on modifie
formulaire.addEventListener("submit", (evenement) => {
  evenement.preventDefault(); // empêche la page de se recharger

  const nom = champNom.value;
  const genre = champGenre.value;
  const taille = champTaille.value.trim().toUpperCase();
  const stock = Number(champStock.value);

  // Vérifie qu'on n'a pas déjà ce vêtement (même nom, même homme/femme, même taille)
  const doublon = donnees.articles.find(
    (a) => a.id !== idEnModification &&
           a.nom.toLowerCase() === nom.toLowerCase() &&
           a.genre === genre &&
           a.taille === taille
  );
  if (doublon) {
    afficherMessage("« " + nomComplet(nom, genre, taille) + " » existe déjà.", true);
    return;
  }

  if (idEnModification) {
    const article = donnees.articles.find((a) => a.id === idEnModification);
    article.nom = nom;
    article.genre = genre;
    article.taille = taille;
    article.stock = stock;
    afficherMessage("Modifications enregistrées.", false);
  } else {
    donnees.articles.push({ id: nouvelIdentifiant(), nom, genre, taille, stock });
    afficherMessage("« " + nomComplet(nom, genre, taille) + " » ajouté !", false);
  }

  enregistrerDonnees();
  viderFormulaire();
  afficherVetements();
});

// ----- Onglet « Stock » : le tableau des quantités -----

const rechercheStock = document.getElementById("recherche-stock");
const tableauStock = document.getElementById("tableau-stock");
const lignesStock = document.getElementById("lignes-stock");
const stockVide = document.getElementById("stock-vide");
const totalStock = document.getElementById("total-stock");

// Tri du tableau Stock :
// 1. d'abord les articles Femme, puis les articles Homme
// 2. ensuite par vêtement, dans l'ordre ci-dessous
// 3. enfin par taille, de la plus petite à la plus grande
const ORDRE_GENRES = ["Femme", "Homme"];
const ORDRE_VETEMENTS = ["Veste softshell", "Veste", "Pantalon"];
const ORDRE_TAILLES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];

// Donne un « rang » à une taille pour pouvoir les classer :
// les tailles en lettres suivent ORDRE_TAILLES, les tailles en chiffres (38, 42…) viennent après
function rangTaille(taille) {
  const position = ORDRE_TAILLES.indexOf(taille);
  if (position !== -1) return position;
  if (!isNaN(Number(taille))) return 100 + Number(taille);
  return 10000; // taille inconnue : tout à la fin
}

function comparerPourStock(a, b) {
  return ORDRE_GENRES.indexOf(a.genre) - ORDRE_GENRES.indexOf(b.genre) ||
         ORDRE_VETEMENTS.indexOf(a.nom) - ORDRE_VETEMENTS.indexOf(b.nom) ||
         rangTaille(a.taille) - rangTaille(b.taille) ||
         a.taille.localeCompare(b.taille, "fr");
}

// Remplit le tableau du stock, en gardant seulement ce qui correspond à la recherche
function afficherStock() {
  const aucunVetement = donnees.articles.length === 0;
  stockVide.hidden = !aucunVetement;
  tableauStock.hidden = aucunVetement;
  rechercheStock.hidden = aucunVetement;

  // Chaque mot tapé doit se retrouver dans le vêtement (ex. « veste femme »)
  const mots = rechercheStock.value.toLowerCase().split(" ").filter((mot) => mot !== "");
  const articlesAffiches = donnees.articles
    .filter((article) => {
      const texte = (article.nom + " " + article.genre + " " + article.taille).toLowerCase();
      return mots.every((mot) => texte.includes(mot));
    })
    .sort(comparerPourStock);

  lignesStock.innerHTML = "";
  articlesAffiches.forEach((article) => {
    const ligne = document.createElement("tr");
    // Classe "femme" ou "homme" pour la couleur de fond (rose ou bleu)
    ligne.classList.add(article.genre.toLowerCase());
    if (article.stock === 0) ligne.classList.add("epuise");

    [article.nom, article.genre, article.taille, article.stock].forEach((valeur, position) => {
      const cellule = document.createElement("td");
      cellule.textContent = valeur;
      if (position === 3) cellule.className = "nombre"; // la colonne Quantité
      ligne.append(cellule);
    });

    lignesStock.append(ligne);
  });

  // Total des pièces affichées
  const total = articlesAffiches.reduce((somme, article) => somme + article.stock, 0);
  totalStock.textContent = aucunVetement ? "" : "Total : " + total + " pièce(s)";

  afficherResumeTailles(articlesAffiches);
}

// ----- Résumé par taille : un tableau par vêtement -----
// Lignes = Femme / Homme, colonnes = tailles, et une colonne Total.
// Exemple pour « Veste » :
//            XS   M   XL   Total
//   Femme     -   4    1      5
//   Homme     2   -    0      2
const resumeTailles = document.getElementById("resume-tailles");

function afficherResumeTailles(articles) {
  resumeTailles.innerHTML = "";
  if (articles.length === 0) return;

  const titre = document.createElement("h2");
  titre.textContent = "Résumé par taille";
  resumeTailles.append(titre);

  // Les vêtements présents, dans l'ordre choisi (Veste softshell, Veste, Pantalon)
  const nomsPresents = [...new Set(articles.map((a) => a.nom))];
  nomsPresents.sort((a, b) => ORDRE_VETEMENTS.indexOf(a) - ORDRE_VETEMENTS.indexOf(b));

  nomsPresents.forEach((nom) => {
    const articlesDuVetement = articles.filter((a) => a.nom === nom);

    // Les tailles de ce vêtement, de la plus petite à la plus grande
    const tailles = [...new Set(articlesDuVetement.map((a) => a.taille))];
    tailles.sort((a, b) => rangTaille(a) - rangTaille(b) || a.localeCompare(b, "fr"));

    // Femme puis Homme (seulement ceux qui existent pour ce vêtement)
    const genres = ORDRE_GENRES.filter((g) => articlesDuVetement.some((a) => a.genre === g));

    const sousTitre = document.createElement("h3");
    sousTitre.textContent = nom;

    const tableau = document.createElement("table");
    tableau.className = "tableau croise";

    // Ligne d'en-tête : vide, puis les tailles, puis Total
    const entete = document.createElement("tr");
    ["", ...tailles, "Total"].forEach((texte) => {
      const cellule = document.createElement("th");
      cellule.textContent = texte;
      entete.append(cellule);
    });
    tableau.append(entete);

    // Une ligne par genre
    genres.forEach((genre) => {
      const ligne = document.createElement("tr");
      ligne.className = genre.toLowerCase(); // rose ou bleu

      const celluleGenre = document.createElement("td");
      celluleGenre.textContent = genre;
      ligne.append(celluleGenre);

      let totalLigne = 0;
      tailles.forEach((taille) => {
        const cellule = document.createElement("td");
        const article = articlesDuVetement.find((a) => a.genre === genre && a.taille === taille);
        if (!article) {
          cellule.textContent = "–"; // ce vêtement n'existe pas dans cette taille
          cellule.className = "vide";
        } else {
          cellule.textContent = article.stock;
          cellule.className = article.stock === 0 ? "nombre zero" : "nombre";
          totalLigne += article.stock;
        }
        ligne.append(cellule);
      });

      const celluleTotal = document.createElement("td");
      celluleTotal.textContent = totalLigne;
      celluleTotal.className = "nombre";
      ligne.append(celluleTotal);

      tableau.append(ligne);
    });

    const defilement = document.createElement("div");
    defilement.className = "defilement";
    defilement.append(tableau);
    resumeTailles.append(sousTitre, defilement);
  });
}

// On met à jour le tableau à chaque lettre tapée dans la recherche
rechercheStock.addEventListener("input", afficherStock);

boutonAnnuler.addEventListener("click", () => {
  viderFormulaire();
  afficherMessage("", false);
});

// ----- Étiquettes QR code -----

const apercu = document.getElementById("apercu");
const zoneEtiquettes = document.getElementById("etiquettes");
const boutonImprimerTout = document.getElementById("bouton-imprimer-tout");

// Prépare les étiquettes des vêtements donnés et les affiche dans l'aperçu.
// Le QR code contient seulement l'identifiant (ex. "VET-0003") : c'est ce que le scanner lira.
function afficherEtiquettes(articles) {
  if (articles.length === 0) {
    alert("Aucun vêtement à imprimer. Ajoute d'abord un vêtement.");
    return;
  }

  zoneEtiquettes.innerHTML = "";
  [...articles].sort(comparerPourStock).forEach((article) => {
    const etiquette = document.createElement("div");
    etiquette.className = "etiquette " + article.genre.toLowerCase();

    const qr = document.createElement("div");
    qr.className = "qr";
    new QRCode(qr, {
      text: article.id,
      width: 160,
      height: 160,
      correctLevel: QRCode.CorrectLevel.M,
    });

    const nom = document.createElement("strong");
    nom.textContent = article.nom;
    const details = document.createElement("span");
    details.textContent = article.genre + " — taille " + article.taille;
    const id = document.createElement("small");
    id.textContent = article.id;

    etiquette.append(qr, nom, details, id);
    zoneEtiquettes.append(etiquette);
  });

  apercu.hidden = false;
}

boutonImprimerTout.addEventListener("click", () => afficherEtiquettes(donnees.articles));

// Dans l'aperçu : « Imprimer » ouvre la fenêtre d'impression, « Fermer » revient à l'app
document.getElementById("bouton-lancer-impression").addEventListener("click", () => window.print());
document.getElementById("bouton-fermer-apercu").addEventListener("click", () => {
  apercu.hidden = true;
});

// ----- Onglet « Scanner » : lire une étiquette puis Entrée / Sortie -----

const boutonCamera = document.getElementById("bouton-camera");
const carteScan = document.getElementById("carte-scan");
const scanNom = document.getElementById("scan-nom");
const scanDetails = document.getElementById("scan-details");
const scanStock = document.getElementById("scan-stock");
const messageScan = document.getElementById("message-scan");
const choixVetement = document.getElementById("choix-vetement");

// Le lecteur de QR code (il affiche la caméra dans la zone "lecteur")
const lecteurQR = new Html5Qrcode("lecteur");
let cameraAllumee = false;
let articleScanne = null; // le vêtement affiché sur la carte (null = aucun)
let minuterieMessage = null;

// Allume la caméra (celle de derrière sur une tablette) et commence à chercher des QR codes
async function allumerCamera() {
  try {
    await lecteurQR.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      quandCodeLu
    );
    cameraAllumee = true;
    boutonCamera.hidden = true;
  } catch (erreur) {
    afficherMessageScan("Impossible d'allumer la caméra. Vérifie que l'app a le droit de l'utiliser.", true);
  }
}

// Éteint la caméra (quand on change d'onglet, pour économiser la batterie)
async function eteindreCamera() {
  if (!cameraAllumee) return;
  await lecteurQR.stop();
  cameraAllumee = false;
  boutonCamera.hidden = false;
}

// Appelée par le lecteur chaque fois qu'il lit un QR code
function quandCodeLu(texte) {
  if (articleScanne) return; // un vêtement est déjà affiché : on attend Entrée / Sortie

  const article = donnees.articles.find((a) => a.id === texte.trim());
  if (!article) {
    afficherMessageScan("Étiquette inconnue (" + texte + "). Ce vêtement a peut-être été supprimé.", true);
    return;
  }
  montrerArticle(article);
}

// Affiche la carte du vêtement avec les boutons Entrée / Sortie
function montrerArticle(article) {
  articleScanne = article;
  if (cameraAllumee) lecteurQR.pause(true); // on fige l'image pendant qu'on choisit

  carteScan.className = "carte-scan " + article.genre.toLowerCase();
  scanNom.textContent = article.nom;
  scanDetails.textContent = article.genre + " — taille " + article.taille;
  scanStock.textContent = article.stock;
  carteScan.hidden = false;
  messageScan.hidden = true;
}

// Cache la carte et relance la lecture
function fermerCarte() {
  articleScanne = null;
  carteScan.hidden = true;
  if (cameraAllumee) lecteurQR.resume();
}

// Affiche un message pendant quelques secondes (vert = ok, rouge = problème)
function afficherMessageScan(texte, estErreur) {
  messageScan.textContent = texte;
  messageScan.classList.toggle("erreur", estErreur);
  messageScan.hidden = false;
  clearTimeout(minuterieMessage);
  minuterieMessage = setTimeout(() => (messageScan.hidden = true), 4000);
}

// Enregistre une entrée (+1) ou une sortie (−1) pour le vêtement affiché
function enregistrerMouvement(type) {
  const article = articleScanne;
  const nom = nomComplet(article.nom, article.genre, article.taille);

  if (type === "sortie" && article.stock === 0) {
    afficherMessageScan("❌ Il n'y a plus de « " + nom + " » en stock.", true);
    fermerCarte();
    return;
  }

  article.stock += type === "entrée" ? 1 : -1;

  // On note le mouvement dans l'historique (avec le nom, au cas où le vêtement serait supprimé plus tard)
  donnees.mouvements.push({
    date: new Date().toISOString(),
    articleId: article.id,
    nom: article.nom,
    genre: article.genre,
    taille: article.taille,
    type: type,
    stockApres: article.stock,
  });

  enregistrerDonnees();
  afficherVetements();
  afficherStock();
  afficherHistorique();

  const action = type === "entrée" ? "✅ Entrée enregistrée" : "✅ Sortie enregistrée";
  afficherMessageScan(action + " : " + nom + ". Il en reste " + article.stock + ".", false);
  fermerCarte();
}

// Remplit la liste « Choisir le vêtement » (pour quand il n'y a pas d'étiquette)
function remplirChoixVetement() {
  choixVetement.innerHTML = '<option value="">Choisir…</option>';
  [...donnees.articles].sort(comparerPourStock).forEach((article) => {
    const option = document.createElement("option");
    option.value = article.id;
    option.textContent = nomComplet(article.nom, article.genre, article.taille);
    choixVetement.append(option);
  });
}

boutonCamera.addEventListener("click", allumerCamera);
document.getElementById("bouton-entree").addEventListener("click", () => enregistrerMouvement("entrée"));
document.getElementById("bouton-sortie").addEventListener("click", () => enregistrerMouvement("sortie"));
document.getElementById("bouton-annuler-scan").addEventListener("click", fermerCarte);

choixVetement.addEventListener("change", () => {
  const article = donnees.articles.find((a) => a.id === choixVetement.value);
  choixVetement.value = "";
  if (article) montrerArticle(article);
});

// ----- Onglet « Historique » -----

const historiqueVide = document.getElementById("historique-vide");
const tableauHistorique = document.getElementById("tableau-historique");
const lignesHistorique = document.getElementById("lignes-historique");
const infoHistorique = document.getElementById("info-historique");
const NB_MOUVEMENTS_AFFICHES = 200; // au-delà, on les retrouve dans l'export Excel

// Transforme une date enregistrée en texte lisible, ex. « 18/10/2026 14:32 »
function dateLisible(dateISO) {
  return new Date(dateISO).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

// Remplit le tableau de l'historique, du plus récent au plus ancien
function afficherHistorique() {
  const mouvements = donnees.mouvements;
  historiqueVide.hidden = mouvements.length > 0;
  tableauHistorique.hidden = mouvements.length === 0;

  lignesHistorique.innerHTML = "";
  const plusRecents = mouvements.slice(-NB_MOUVEMENTS_AFFICHES).reverse();

  plusRecents.forEach((mouvement) => {
    const ligne = document.createElement("tr");
    ligne.className = mouvement.genre.toLowerCase(); // rose ou bleu

    const texteMouvement = mouvement.type === "entrée" ? "⬇️ Entrée" : "⬆️ Sortie";
    const valeurs = [
      dateLisible(mouvement.date),
      mouvement.nom,
      mouvement.genre,
      mouvement.taille,
      texteMouvement,
      mouvement.stockApres,
    ];

    valeurs.forEach((valeur, position) => {
      const cellule = document.createElement("td");
      cellule.textContent = valeur;
      if (position === 4) cellule.className = mouvement.type === "entrée" ? "mouvement-entree" : "mouvement-sortie";
      if (position === 5) cellule.className = "nombre";
      ligne.append(cellule);
    });

    lignesHistorique.append(ligne);
  });

  infoHistorique.textContent =
    mouvements.length > NB_MOUVEMENTS_AFFICHES
      ? "Les " + NB_MOUVEMENTS_AFFICHES + " derniers mouvements sur " + mouvements.length + ". Tout est dans l'export Excel."
      : "";
}

// ----- Sauvegarde, rechargement et export Excel -----

const derniereSauvegarde = document.getElementById("derniere-sauvegarde");
const champFichier = document.getElementById("fichier-sauvegarde");
const messageSauvegarde = document.getElementById("message-sauvegarde");

function afficherMessageSauvegarde(texte, estErreur) {
  messageSauvegarde.textContent = texte;
  messageSauvegarde.classList.toggle("erreur", estErreur);
}

const rappelCopie = document.getElementById("rappel-copie");
const texteRappel = document.getElementById("texte-rappel");
const JOURS_AVANT_RAPPEL = 7;

function afficherDerniereSauvegarde() {
  derniereSauvegarde.textContent = donnees.derniereSauvegarde
    ? "Dernière copie de secours : " + dateLisible(donnees.derniereSauvegarde)
    : "Aucune copie de secours faite pour l'instant.";
  afficherRappelCopie();
}

// Affiche le bandeau jaune si la dernière copie de secours date de plus de 7 jours
// (ou s'il n'y en a jamais eu alors qu'il y a déjà des vêtements)
function afficherRappelCopie() {
  if (donnees.articles.length === 0) {
    rappelCopie.hidden = true;
    return;
  }

  if (!donnees.derniereSauvegarde) {
    texteRappel.textContent = "⚠️ Aucune copie de secours n'a encore été faite.";
    rappelCopie.hidden = false;
    return;
  }

  const millisecondesParJour = 24 * 60 * 60 * 1000;
  const jours = Math.floor((Date.now() - new Date(donnees.derniereSauvegarde)) / millisecondesParJour);
  texteRappel.textContent = "⚠️ Dernière copie de secours il y a " + jours + " jours.";
  rappelCopie.hidden = jours < JOURS_AVANT_RAPPEL;
}

// Fait télécharger un fichier au navigateur (il arrive dans le dossier « Téléchargements »)
function telechargerFichier(nomFichier, contenu, type) {
  const fichier = new Blob([contenu], { type: type });
  const lien = document.createElement("a");
  lien.href = URL.createObjectURL(fichier);
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(lien.href);
}

// La date du jour pour le nom des fichiers, ex. « 2026-10-18 »
function dateDuJour() {
  return new Date().toISOString().slice(0, 10);
}

// 💾 Copie de secours : toutes les données dans un fichier .json
function sauvegarder() {
  donnees.derniereSauvegarde = new Date().toISOString();
  enregistrerDonnees();
  telechargerFichier(
    "sauvegarde-stock-" + dateDuJour() + ".json",
    JSON.stringify(donnees, null, 2),
    "application/json"
  );
  afficherDerniereSauvegarde();
  afficherMessageSauvegarde("Copie de secours faite ! Le fichier est dans « Téléchargements ».", false);
}

// 📂 Récupérer une copie : remplace toutes les données par celles du fichier de secours
function recharger(fichier) {
  const lecteur = new FileReader();
  lecteur.onload = () => {
    let sauvegarde;
    try {
      sauvegarde = JSON.parse(lecteur.result);
    } catch (erreur) {
      afficherMessageSauvegarde("Ce fichier n'est pas une copie de secours de l'app.", true);
      return;
    }

    // On vérifie que le fichier ressemble bien à une sauvegarde
    if (!Array.isArray(sauvegarde.articles) || !Array.isArray(sauvegarde.mouvements) ||
        typeof sauvegarde.prochainNumero !== "number") {
      afficherMessageSauvegarde("Ce fichier n'est pas une copie de secours de l'app.", true);
      return;
    }

    const ok = confirm(
      "Récupérer cette copie de secours ?\n" +
      sauvegarde.articles.length + " vêtement(s) et " + sauvegarde.mouvements.length + " mouvement(s).\n\n" +
      "⚠️ Les données actuelles de la tablette seront remplacées."
    );
    if (!ok) return;

    donnees = sauvegarde;
    enregistrerDonnees();
    afficherTout();
    afficherMessageSauvegarde("Copie de secours récupérée !", false);
  };
  lecteur.readAsText(fichier);
}

// 📊 Export Excel : l'historique complet dans un fichier .csv
function exporterExcel() {
  if (donnees.mouvements.length === 0) {
    afficherMessageSauvegarde("Il n'y a encore aucun mouvement à exporter.", true);
    return;
  }

  // Excel en français utilise le point-virgule pour séparer les colonnes
  const entete = ["Date", "Vêtement", "Homme / Femme", "Taille", "Mouvement", "Reste"];
  const lignes = donnees.mouvements.map((m) => [
    dateLisible(m.date), m.nom, m.genre, m.taille, m.type === "entrée" ? "Entrée" : "Sortie", m.stockApres,
  ]);
  const texte = [entete, ...lignes]
    .map((ligne) => ligne.map((valeur) => '"' + String(valeur).replace(/"/g, '""') + '"').join(";"))
    .join("\r\n");

  // "﻿" au début : pour que Excel affiche bien les accents
  telechargerFichier("historique-stock-" + dateDuJour() + ".csv", "﻿" + texte, "text/csv");
  afficherMessageSauvegarde("Fichier Excel téléchargé.", false);
}

document.getElementById("bouton-sauvegarder").addEventListener("click", sauvegarder);
document.getElementById("bouton-copie-rappel").addEventListener("click", sauvegarder);
document.getElementById("bouton-recharger").addEventListener("click", () => champFichier.click());
document.getElementById("bouton-excel").addEventListener("click", exporterExcel);
champFichier.addEventListener("change", () => {
  if (champFichier.files[0]) recharger(champFichier.files[0]);
  champFichier.value = ""; // pour pouvoir recharger le même fichier une autre fois
});

// Met à jour tous les onglets d'un coup
function afficherTout() {
  afficherVetements();
  afficherStock();
  afficherHistorique();
  afficherDerniereSauvegarde();
}

// ----- Au démarrage de l'app -----
afficherTout();
