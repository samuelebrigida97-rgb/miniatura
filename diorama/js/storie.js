/* =========================================================
   STORIE IN PIÙ: piccole scene "qua e là" lungo il percorso
   (Sansone, Giona nel grande pesce, Elia sul carro di fuoco…)
   Ogni storia ha la sua lista di figure e materiali.
   ========================================================= */
const STORIE = [
  { id: "sansone", nome: "Sansone e il leone", rif: "Giudici 14,5-6", tappa: 12,
    storia: "Sulla strada per Timna un giovane leone ruggisce contro Sansone: lo Spirito del Signore scende su di lui e lo abbatte a mani nude.",
    figure: [{ nome: "Sansone con i capelli lunghi", misura: "1,2 cm", qta: 1 }, { nome: "Leone in piedi sulle zampe posteriori", misura: "1 cm", qta: 1 }, { nome: "Mascella d'asino", misura: "4 mm", qta: 1 }],
    materiali: [["Roccia o sasso piatto come basetta", "1"], ["Erba secca / ciuffi di erba statica", "un pizzico"], ["Colori acrilici: ocra, marrone, nero", "—"]],
    costruisci: ["Incolla un sasso piatto vicino al sentiero.", "Fissa il leone in piedi con una goccia di colla cianoacrilica.", "Metti Sansone davanti al leone, con le braccia alzate.", "Aggiungi la mascella d'asino a terra e qualche ciuffo d'erba secca."] },
  { id: "gedeone", nome: "Gedeone, il vello e le brocche", rif: "Giudici 6,36-40; 7,16-20", tappa: 12,
    storia: "Gedeone chiede un segno: il vello di lana è bagnato di rugiada e il terreno asciutto. Poi i suoi 300 uomini spezzano le brocche e alzano le fiaccole.",
    figure: [{ nome: "Gedeone in ginocchio", misura: "1 cm", qta: 1 }, { nome: "Soldati con brocca e fiaccola", misura: "1 cm", qta: 3 }, { nome: "Brocche (una rotta)", misura: "3 mm", qta: 4 }],
    materiali: [["Batuffolo di lana o cotone (il vello)", "1"], ["Vernice lucida trasparente (rugiada)", "qualche goccia"], ["LED arancione tremolante 3 mm 12 V (fiaccole)", "1"]],
    costruisci: ["Stendi un pezzetto di lana bianca sul terreno e bagnalo con vernice lucida.", "Metti Gedeone inginocchiato accanto al vello.", "Disponi tre soldati con brocche e fiaccole; una brocca rotta a terra.", "Fai passare il LED sotto la base per far brillare la fiaccola."] },
  { id: "isacco", nome: "Il sacrificio di Isacco", rif: "Genesi 22,1-14", tappa: 6,
    storia: "Sul monte Moria Abramo è pronto a obbedire, ma l'angelo lo ferma: un ariete impigliato nel cespuglio prende il posto di Isacco.",
    figure: [{ nome: "Abramo con il braccio alzato", misura: "1 cm", qta: 1 }, { nome: "Isacco disteso", misura: "1 cm", qta: 1 }, { nome: "Angelo", misura: "1 cm", qta: 1 }, { nome: "Ariete", misura: "5 mm", qta: 1 }],
    materiali: [["Pietre piccole per l'altare", "6-8"], ["Rametti sottili (legna)", "5"], ["Cespuglio da modellismo", "1"], ["Filo di ferro sottile per l'angelo sospeso", "5 cm"]],
    costruisci: ["Costruisci un altarino di pietre (1 x 0,6 cm) e mettici sopra i rametti.", "Distendi Isacco sull'altare.", "Abramo accanto, col braccio alzato.", "L'angelo su un filo di ferro, sopra di loro; l'ariete nel cespuglio."] },
  { id: "balaam", nome: "Balaam e l'asina", rif: "Numeri 22,21-35", tappa: 11,
    storia: "L'asina vede l'angelo con la spada sulla strada e si ferma: il Signore apre la sua bocca e lei parla a Balaam.",
    figure: [{ nome: "Asina", misura: "8 mm", qta: 1 }, { nome: "Balaam seduto in groppa", misura: "1 cm", qta: 1 }, { nome: "Angelo con la spada", misura: "1 cm", qta: 1 }],
    materiali: [["Muretto di sassolini ai lati della strada", "10 sassolini"], ["Vernice argento (spada)", "—"]],
    costruisci: ["Fai un tratto di stradina stretta con due muretti bassi.", "Metti l'asina accovacciata e Balaam in groppa.", "Di fronte, l'angelo con la spada sguainata (punta argento)."] },
  { id: "mose", nome: "Mosè salvato dalle acque", rif: "Esodo 2,1-10", tappa: 10,
    storia: "La madre mette il piccolo Mosè in un cesto spalmato di pece tra i giunchi del Nilo; la figlia del faraone lo trova, Miriam guarda da lontano.",
    figure: [{ nome: "Cesto con il bambino", misura: "5 mm", qta: 1 }, { nome: "Figlia del faraone", misura: "1 cm", qta: 1 }, { nome: "Miriam", misura: "0,9 cm", qta: 1 }],
    materiali: [["Spago o rafia (per il cesto)", "20 cm"], ["Setole di scopa / giunchi (canne)", "15"], ["Resina trasparente (acqua)", "già nel fiume"]],
    costruisci: ["Avvolgi lo spago a spirale e incollalo: diventa un cestino di 5 mm.", "Incollalo nel fiume, prima della resina, vicino alla riva.", "Pianta i giunchi attorno.", "Sulla riva metti la figlia del faraone e, poco lontano, Miriam."] },
  { id: "elia", nome: "Elia sul carro di fuoco", rif: "2 Re 2,11-12", tappa: 15,
    storia: "Un carro di fuoco con cavalli di fuoco separa Elia da Eliseo, ed Elia sale al cielo nel turbine. Il suo mantello cade a Eliseo.",
    figure: [{ nome: "Carro con due ruote", misura: "1,5 cm", qta: 1 }, { nome: "Cavalli di fuoco", misura: "1,2 cm", qta: 2 }, { nome: "Elia", misura: "1 cm", qta: 1 }, { nome: "Eliseo con il mantello", misura: "1 cm", qta: 1 }],
    materiali: [["Filo di rame 1 mm (il turbine a spirale)", "30 cm"], ["Stampa in PLA trasparente o vernice arancio traslucida", "—"], ["LED arancione tremolante 12 V", "1"]],
    costruisci: ["Piega il filo di rame a spirale (turbine) e piantalo nel terreno.", "Incolla in cima il carro con i cavalli, inclinato verso il cielo.", "Dipingi carro e cavalli di arancio traslucido; il LED alla base li illumina.", "A terra metti Eliseo che raccoglie il mantello."] },
  { id: "giona", nome: "Giona nel grande pesce", rif: "Giona 2", tappa: 15,
    storia: "Giona fugge da Dio, viene gettato in mare e inghiottito da un grande pesce. Dopo tre giorni il pesce lo rigetta sulla spiaggia.",
    figure: [{ nome: "Grande pesce con la bocca aperta", misura: "4 cm", qta: 1 }, { nome: "Giona", misura: "1 cm", qta: 1 }, { nome: "Barca dei marinai", misura: "2 cm", qta: 1 }],
    materiali: [["Resina epossidica (mare)", "50 ml"], ["Gel per acqua / silicone (onde e schiuma)", "1 tubetto"], ["Pittura bianca (schiuma)", "—"]],
    costruisci: ["Incolla il pesce nel mare prima di colare la resina: deve sporgere per metà.", "Metti Giona nella bocca aperta del pesce.", "Cola la resina e, quando è dura, fai le onde con il gel.", "Spennella di bianco le creste e lo spruzzo del pesce."] },
  { id: "fornace", nome: "I tre giovani nella fornace", rif: "Daniele 3", tappa: 16,
    storia: "Sadrac, Mesac e Abdenego non adorano la statua d'oro: gettati nella fornace ardente, camminano illesi e con loro c'è un quarto, simile a un figlio di dèi.",
    figure: [{ nome: "Fornace di mattoni con apertura", misura: "1,5 x 1 cm", qta: 1 }, { nome: "Tre giovani", misura: "1 cm", qta: 3 }, { nome: "Quarto uomo luminoso (angelo)", misura: "1 cm", qta: 1 }, { nome: "Re Nabucodonosor", misura: "1 cm", qta: 1 }, { nome: "Statua d'oro", misura: "3 cm", qta: 1 }],
    materiali: [["LED arancione tremolante 12 V (fuoco)", "1"], ["Carta velina gialla/arancio", "1 foglio"], ["Vernice oro", "—"]],
    costruisci: ["Stampa la fornace vuota dentro e fai un foro nel fondo per il LED.", "Metti i quattro uomini dentro, in piedi.", "Fiamme di carta velina all'apertura, illuminate dal LED.", "Fuori: il re con la corona e la statua d'oro."] },
  { id: "ossa", nome: "Ezechiele e le ossa secche", rif: "Ezechiele 37,1-14", tappa: 16,
    storia: "In una valle piena di ossa secche il profeta parla nel nome di Dio: le ossa si riuniscono e lo Spirito le fa rivivere.",
    figure: [{ nome: "Ezechiele", misura: "1 cm", qta: 1 }, { nome: "Ossa sparse", misura: "1-3 mm", qta: 30 }, { nome: "Teschi", misura: "2 mm", qta: 4 }],
    materiali: [["Stuzzicadenti spezzati e dipinti avorio", "15"], ["Sabbia grigia", "1 cucchiaio"]],
    costruisci: ["Spargi sabbia grigia in una conca (valle).", "Incolla ossa e teschi qua e là.", "Ezechiele in piedi al bordo, con un braccio alzato."] },
  { id: "acque", nome: "Gesù cammina sulle acque", rif: "Matteo 14,22-33", tappa: 19,
    storia: "Di notte, nella tempesta, Gesù va verso i discepoli camminando sul lago. Pietro scende dalla barca, ha paura e affonda: Gesù lo afferra.",
    figure: [{ nome: "Gesù in piedi sull'acqua", misura: "1 cm", qta: 1 }, { nome: "Pietro che affonda (mezza figura)", misura: "0,6 cm", qta: 1 }, { nome: "Barca con discepoli", misura: "2,5 cm", qta: 1 }],
    materiali: [["Resina del lago (già prevista)", "—"], ["Gel per acqua (onde)", "un po'"], ["Spillo per fissare Gesù sopra la resina", "1"]],
    costruisci: ["Fissa Gesù su uno spillo: sembrerà camminare sull'acqua.", "Pietro immerso a metà nella resina, con la mano tesa.", "La barca poco lontano, inclinata dalle onde."] },
  { id: "zaccheo", nome: "Zaccheo sul sicomoro", rif: "Luca 19,1-10", tappa: 19,
    storia: "Zaccheo è piccolo di statura e sale su un sicomoro per vedere Gesù. Gesù alza lo sguardo: «Scendi subito, oggi devo fermarmi a casa tua».",
    figure: [{ nome: "Zaccheo (piccolo)", misura: "0,8 cm", qta: 1 }, { nome: "Gesù che indica in alto", misura: "1 cm", qta: 1 }, { nome: "Folla", misura: "1 cm", qta: 4 }],
    materiali: [["Albero da modellismo 5-6 cm (o filo di ferro intrecciato + flock)", "1"], ["Colla a caldo", "—"]],
    costruisci: ["Pianta l'albero vicino al sentiero.", "Incolla Zaccheo su un ramo, a 3-4 cm di altezza.", "Sotto, Gesù col braccio alzato e la folla intorno."] },
  { id: "prodigo", nome: "Il figlio prodigo", rif: "Luca 15,11-32", tappa: 20,
    storia: "Il figlio sperpera tutto e finisce a pascolare i porci; poi torna a casa. Il padre lo vede da lontano, gli corre incontro e lo abbraccia.",
    figure: [{ nome: "Padre e figlio abbracciati", misura: "1 cm", qta: 1 }, { nome: "Maiali", misura: "4 mm", qta: 3 }, { nome: "Casa del padre", misura: "1,5 cm", qta: 1 }],
    materiali: [["Recinto di stuzzicadenti", "8"], ["Colore rosa e fango", "—"]],
    costruisci: ["Metti la casa del padre e davanti i due abbracciati.", "Più in là un piccolo recinto con i maiali nel fango."] },
  { id: "lazzaro", nome: "La risurrezione di Lazzaro", rif: "Giovanni 11,38-44", tappa: 20,
    storia: "Davanti alla tomba scavata nella roccia Gesù grida: «Lazzaro, vieni fuori!», e il morto esce con le bende ancora addosso.",
    figure: [{ nome: "Tomba nella roccia con pietra rotolata", misura: "2 cm", qta: 1 }, { nome: "Lazzaro bendato", misura: "1 cm", qta: 1 }, { nome: "Gesù, Marta e Maria", misura: "1 cm", qta: 3 }],
    materiali: [["Sughero o pietra (roccia)", "1 pezzo"], ["Garza sottile (bende)", "2 x 5 cm"]],
    costruisci: ["Scava un'apertura nella roccia e appoggia di lato una pietra tonda.", "Avvolgi la figura di Lazzaro con una striscia di garza.", "Davanti Gesù, Marta e Maria."] },
  { id: "samaritano", nome: "Il buon samaritano", rif: "Luca 10,30-37", tappa: 21,
    storia: "Sulla strada da Gerusalemme a Gerico un uomo viene picchiato e lasciato a terra. Un samaritano si ferma, lo cura e lo carica sul suo asino.",
    figure: [{ nome: "Uomo ferito a terra", misura: "1 cm", qta: 1 }, { nome: "Samaritano chinato", misura: "1 cm", qta: 1 }, { nome: "Asino", misura: "8 mm", qta: 1 }],
    materiali: [["Ghiaietto per la strada", "1 cucchiaio"], ["Garza (bende)", "1 striscia"]],
    costruisci: ["Fai un tratto di strada sassosa.", "Stendi il ferito con una benda, il samaritano chinato su di lui.", "L'asino che aspetta accanto."] },
];

/* Le storie entrano anche nel manuale (fase 10) e nella lista completa dei materiali */
(function () {
  const f10 = FASI.find((f) => f.n === 10);
  if (f10) f10.passi.push("Aggiungi le STORIE IN PIÙ qua e là vicino alle tappe: " + STORIE.map((s) => s.nome).join(", ") + ". Ogni storia ha la sua lista nella scheda Materiali.");
  const viste = {}, voci = [];
  STORIE.forEach((s) => s.materiali.forEach(([n, q]) => { if (!viste[n]) { viste[n] = 1; voci.push([n + " (" + s.nome + ")", q]); } }));
  voci.push(["Figure delle storie in più da stampare in 3D", STORIE.reduce((t, s) => t + s.figure.reduce((a, f) => a + f.qta, 0), 0) + " pezzi"]);
  MATERIALI.push({ gruppo: "Storie in più (Sansone, Giona, Elia…)", voci });
})();
