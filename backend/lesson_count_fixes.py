"""Titoli, agganci e obiettivi delle lezioni "Impara" allineati ai 6 passi.

Molte lezioni (v4, v5 e le prime `lez-*`) sono nate con 4 passi e poi sono
state portate a 6 capitoli (normalize_chapters.py / generate_lesson_step5.py),
ma titolo, hook, riassunto o obiettivo promettevano ancora "4 passi", "quattro
regole", "4 gesti"... Qui le correzioni editoriali, una per lezione:

  * dove i capitoli sono davvero sei passi dello stesso tipo → "6 passi";
  * dove i due capitoli aggiunti sono di altro genere (eccezione, "cosa fare
    dopo", esercizio) il numero sparisce o passa su "6 passi" del percorso.

I numeri che descrivono il contenuto di un capitolo (le tre fasi della
memoria, le cinque domande dello storico, "6 ore bastano e 8 no") restano.

Applicato al seed a ogni avvio (`apply_lesson_count_fixes` in ensure_seed):
i file seed restano intatti, il DB è sempre coerente.
"""
from __future__ import annotations

# id → {campo: testo} (+ "en": {campo: testo} dove esiste la traduzione).
FIXES: dict[str, dict] = {
    "v4-lez-densita": {"hook": "Una nave di acciaio galleggia, un chiodo affonda. Non è il peso a decidere: è un rapporto che puoi imparare in sei passi."},
    "v4-lez-atomo": {"hook": "Tutto ciò che tocchi è fatto di atomi, eppure sono quasi interamente vuoti. Ecco come immaginarli in modo corretto in sei passi."},
    "v4-lez-leggere-etichetta": {"hook": "Detersivi, cosmetici, alimenti: dietro nomi lunghi si nascondono pochi concetti. Impara a decodificarli in sei passi."},
    "v4-lez-fasi-luna": {"hook": "Non è l'ombra della Terra. È solo una questione di angoli tra tre corpi. In sei passi imparerai a leggere la Luna come un orologio."},
    "v4-lez-riconoscere-pianeti": {"hook": "Quel puntino brillante non è una stella. In sei passi, e senza telescopio, impari a distinguere Venere, Giove, Marte e Saturno."},
    "v4-lez-riconoscere-phishing": {
        "title": "Riconoscere un'email di phishing in 6 passi",
        "hook": "Le truffe via email non sono più piene di errori di ortografia. Ma lasciano sempre indizi, se sai dove guardare: sei passi per riconoscerle e reagire.",
    },
    "v4-lez-cloud": {"hook": "Le tue foto non stanno in una nuvola. Stanno in un capannone, su dischi rigidi, copiate più volte. Ecco come funziona in sei passi."},
    "v4-lez-batteria": {"hook": "Mezzi miti e vecchi consigli non valgono più per le batterie al litio. Sei passi per capire come funzionano davvero e farle durare."},
    "v4-lez-fotosintesi": {"title": "La fotosintesi in 6 passi: come una foglia fa il cibo dalla luce"},
    "v4-lez-orientarsi-natura": {"title": "Orientarsi senza bussola: 6 indizi che la natura ti dà"},
    "v4-lez-leggere-fiume": {"hook": "Increspature, pieghe e schiuma raccontano cosa c'è sul fondo. Sei passi per capire un corso d'acqua prima di attraversarlo o pescarci."},
    "v4-lez-osservare-uccelli": {"title": "Riconoscere gli uccelli in città: il metodo in 6 passi"},
    "v4-lez-incontro-fauna": {"hook": "Un cinghiale al parco, una vipera sul sentiero, un cane sconosciuto: reagire male è la causa principale degli incidenti. Sei passi per reagire nel modo giusto."},
    "v4-lez-catena-alimentare": {"hook": "Miliardi di insetti, milioni di rane, migliaia di serpenti, pochi falchi. Non è un caso: è una legge dell'energia che puoi capire in sei passi."},
    "v4-lez-leggere-mappa-storica": {"hook": "Confini, nomi e colori raccontano il punto di vista di chi disegnava. Sei passi per capire cosa una mappa mostra e cosa nasconde."},
    "v4-lez-perche-cadono-imperi": {"title": "Perché cadono gli imperi: gli schemi che si ripetono, in 6 passi"},
    "v4-lez-abitudini": {"title": "Costruire un'abitudine in 6 passi (e perché la forza di volontà non basta)"},
    "v4-lez-ascolto-attivo": {"hook": "La maggior parte delle discussioni non fallisce per quello che si dice, ma per quello che non si ascolta. Una tecnica in sei passi usata da mediatori e terapeuti."},
    "v4-lez-gestire-ansia": {"title": "Gestire un momento di ansia in 6 passi: tecniche che funzionano in 5 minuti"},
    "v4-lez-leggere-battito": {"hook": "Il polso è il dato di salute più facile da misurare e uno dei più informativi. Sei passi per misurarlo bene e capire cosa significa."},
    "v4-lez-primo-soccorso": {
        "title": "Le 6 mosse di primo soccorso che tutti dovrebbero sapere",
        "hook": "Nei primi minuti di un'emergenza non c'è ancora l'ambulanza: ci sei tu. Sei passi semplici che salvano vite, spiegati senza tecnicismi.",
    },
    "v4-lez-galateo-mondo": {"title": "Buone maniere nel mondo in 6 passi: i gesti che cambiano significato"},
    "v4-lez-leggere-poesia": {"hook": "Non si tratta di 'capire cosa voleva dire il poeta'. Si tratta di leggere lentamente e in modo diverso. Sei passi che funzionano con Dante e con i testi delle canzoni."},
    "v4-lez-imparare-lingua": {"title": "Imparare una lingua da adulti: cosa dice la ricerca in 6 punti"},
    "v4-lez-budget-50-30-20": {"title": "Il budget 50/30/20: gestire lo stipendio in 6 passi"},
    "v4-lez-leggere-busta-paga": {"hook": "Tra ciò che costi all'azienda e ciò che arriva sul conto c'è quasi la metà. Sei passi per capire le voci e controllare che tutto sia corretto."},
    "v5-lez-reazione-chimica": {"title": "Come riconoscere una reazione chimica in 6 passi"},
    "v5-lez-costellazioni": {"hook": "Ogni sera il cielo cambia un po', e in un anno fa un giro completo. In sei passi impari una figura per stagione e non ti senti più perso di notte."},
    "v5-lez-motore-ricerca": {"title": "Come funziona un motore di ricerca in 6 passi"},
    "v5-lez-riconoscere-alberi": {
        "title": "Riconoscere gli alberi dalle foglie in 6 passi",
        "hook": "Quercia, faggio, acero, tiglio: li vedi ogni giorno e non sai come si chiamano. Con poche domande sulla foglia, in sei passi, arrivi al nome nella maggior parte dei casi.",
        "summary": "Prima chiediti: aghi o foglie? Poi: foglia semplice o composta? Poi: margine liscio, dentato o lobato? Infine: come sono disposte sul ramo? Poche risposte restringono a poche specie; corteccia e frutti confermano.",
    },
    "v5-lez-ecosistema": {
        "title": "Come funziona un ecosistema in 6 passi: i ruoli che reggono tutto",
        "hook": "Uno stagno, un bosco, la tua siepe: ognuno è una rete dove nulla si spreca. Sei passi per capire chi fa cosa e perché togliere una specie fa crollare le altre.",
    },
    "v5-lez-compost": {"title": "Fare il compost in casa: dai rifiuti alla terra in 6 passi"},
    "v5-lez-comunicazione-animale": {
        "title": "Come parlano gli animali: i canali della comunicazione in 6 passi",
        "objective": "Riconoscere i canali principali della comunicazione animale e interpretare qualche segnale comune.",
    },
    "v5-lez-insetti-utili": {"hook": "Prima di spruzzare qualcosa contro 'gli insetti', vale la pena sapere che la maggior parte sta dalla tua parte. Ecco gli alleati da riconoscere e proteggere, in sei passi."},
    "v5-lez-datare-reperti": {"title": "Come si dà una data a un reperto: i metodi in 6 passi"},
    "v5-lez-nascita-citta": {"title": "Come nasce una città in 6 passi: le condizioni che si ripetono"},
    "v5-lez-medioevo": {"title": "Il Medioevo non era buio: 6 passi per smontare i luoghi comuni"},
    "v5-lez-distorsioni": {"title": "Le distorsioni del pensiero: riconoscerle e smontarle in 6 passi"},
    "v5-lez-feedback": {"title": "Dare un feedback che viene ascoltato: il metodo in 6 passi"},
    "v5-lez-decisioni": {"title": "Prendere una decisione difficile in 6 passi: strumenti che funzionano"},
    "v5-lez-digestione": {"title": "Il viaggio di un boccone: la digestione in 6 passi"},
    "v5-lez-etichetta-nutrizionale": {"title": "Leggere un'etichetta alimentare in 6 mosse"},
    "v5-lez-postura": {
        "title": "Mal di schiena da scrivania: 6 passi che funzionano davvero",
        "objective": "Capire perché stare seduti a lungo fa male e applicare accorgimenti concreti per ridurre il dolore lombare e cervicale.",
    },
    "v5-lez-cognomi": {"title": "Da dove viene il tuo cognome: le origini dei cognomi italiani in 6 passi"},
    "v5-lez-gesti-italiani": {
        "title": "I gesti italiani in 6 passi: cosa significano e da dove vengono",
        "objective": "Conoscere significato, uso e origine dei gesti italiani più comuni e capire perché l'Italia ne ha così tanti.",
    },
    "v5-lez-opera-lirica": {"hook": "Tre ore di canto in italiano antico, trame che sembrano assurde, un pubblico che sa quando applaudire. Con sei cose da sapere, l'opera diventa quello che è sempre stata: uno spettacolo popolare."},
    "v5-lez-struttura-fiaba": {"title": "Come è fatta una fiaba in 6 passi: gli elementi che si ripetono ovunque"},
    "v5-lez-grafici-ingannevoli": {
        "title": "Come un grafico può mentire dicendo la verità: 6 passi per non caderci",
        "hook": "I numeri sono corretti, le fonti citate, e il messaggio è falso. I grafici ingannevoli non inventano dati: scelgono come mostrarli. Bastano sei passi per non caderci.",
    },
    "v5-lez-fondo-emergenza": {"title": "Il fondo di emergenza: costruirlo in 6 passi anche con poco"},
    "v5-lez-guardare-quadro": {"title": "Come guardare un quadro: 6 passi per non passare oltre in 8 secondi"},
    "v5-lez-regola-terzi": {"title": "La regola dei terzi: comporre una foto o un'immagine in 6 mosse"},
    "v5-lez-scegliere-font": {"title": "Scegliere un carattere: 6 passi per non sbagliare font"},
    "v5-lez-storia-arte-tappe": {
        "title": "Cinquecento anni di pittura in 6 tappe",
        "hook": "Dal Rinascimento all'astrattismo, la pittura occidentale ha cambiato completamente ciò che voleva fare. Con sei punti di riferimento puoi collocare quasi ogni quadro che incontri.",
    },
    "v5-lez-leggere-edificio": {"title": "Leggere un edificio in 6 passi: gli stili architettonici in strada"},
    "v5-lez-coordinate": {"title": "Latitudine e longitudine: leggere le coordinate in 6 passi"},
    "v5-lez-jet-lag": {"title": "Battere il jet lag: 6 passi prima, durante e dopo il volo"},
    "v5-lez-leggere-valle": {"hook": "Una valle a V o a U, un lago in alto, un masso enorme nel mezzo di un prato. Il paesaggio è un libro scritto da acqua e ghiaccio, e in sei passi sai leggere chi ha fatto cosa."},
    "lez-metodo-scientifico": {
        "title": "Come ragiona uno scienziato: il metodo in 6 passi",
        "en": {"title": "How a scientist thinks: the method in 6 steps"},
    },
    "lez-orientarsi-stelle": {
        "title": "Come orientarsi con le stelle in 6 mosse",
        "en": {"title": "How to navigate by the stars in 6 moves"},
    },
    "lez-ciclo-acqua": {
        "objective": "Descrivere le fasi del ciclo dell'acqua e spiegare perché l'acqua dolce è una risorsa limitata.",
        "en": {"objective": "Describe the phases of the water cycle and explain why fresh water is a limited resource."},
    },
    "lez-classificare-animali": {
        "title": "Come si classificano gli animali: la mappa in 6 passi",
        "hook": "Un delfino è un pesce? Un pipistrello è un uccello? Con poche domande in ordine non sbagli più.",
        "en": {
            "title": "How animals are classified: the map in 6 steps",
            "hook": "Is a dolphin a fish? Is a bat a bird? With a few questions in order you'll never get it wrong again.",
        },
    },
}


def apply_lesson_count_fixes(payload: dict) -> dict:
    """Sovrascrive nel payload del seed i campi corretti (IT e, se presente, EN)."""
    fix = FIXES.get(payload.get("id") or "")
    if not fix:
        return payload
    for field, text in fix.items():
        if field == "en":
            en = (payload.get("translations") or {}).get("en")
            if en:
                en.update(text)
        else:
            payload[field] = text
    return payload
