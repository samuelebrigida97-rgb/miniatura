/* =========================================================
   DATI DEL MANUALE
   Qui c'è tutto il "contenuto": tappe, fasi e materiali.
   Puoi modificare i testi liberamente: l'app si aggiorna da sola.
   Le coordinate (x, y) sono in MILLIMETRI sul tabellone 800 x 500:
   x = da sinistra verso destra, y = dall'alto verso il basso.
   ========================================================= */

// Le 4 zone di colore del terreno
const ZONE = {
  origini:   { nome: "Origini",              colore: "#6fa04f", tinta: "verde e blu" },
  patriarchi:{ nome: "Patriarchi ed Esodo",  colore: "#d8b26e", tinta: "sabbia e ocra" },
  re:        { nome: "Re e Profeti",         colore: "#b5a68d", tinta: "pietra e oro" },
  vangeli:   { nome: "Vangeli e Apocalisse", colore: "#efe6d2", tinta: "bianco e luce" },
};

// ---------------------------------------------------------
// LE 23 TAPPE
// ---------------------------------------------------------
const TAPPE = [
  { n: 1, nome: "Creazione", sotto: "Luce e buio", zona: "origini", x: 55, y: 55,
    rif: "Genesi 1,1-5",
    storia: "In principio Dio crea il cielo e la terra. La terra è informe e buia; Dio dice «Sia la luce!» e separa la luce dalle tenebre: è il primo giorno.",
    costruisci: [
      "Casella divisa a metà: una parte dipinta di nero-blu notte, l'altra bianco-oro.",
      "Al centro un disco di luce leggermente rialzato (2-3 mm).",
      "Facoltativo: un LED bianco freddo sotto il disco, coperto da plastica opaca."
    ],
    figure: [
      { nome: "Disco della luce (sole stilizzato)", misura: "Ø 3 cm, spessore 3 mm", qta: 1 },
      { nome: "Stelline a rilievo", misura: "5 mm", qta: 10 }
    ] },

  { n: 2, nome: "Eden", sotto: "Albero della vita e serpente", zona: "origini", x: 70, y: 230,
    rif: "Genesi 2,8-17; 3,1-7",
    storia: "Dio pianta un giardino in Eden e vi mette l'uomo. In mezzo al giardino c'è l'albero della vita; da Eden esce un fiume che irriga il giardino. Il serpente tenta la donna.",
    costruisci: [
      "Altopiano verde (schiuma alta 5-6 cm): qui NASCE il fiume della vita.",
      "Albero della vita sopra la sorgente: il foro del tubo è nascosto tra le radici.",
      "Prato con fiori, animali in pace (leone vicino all'agnello), Adamo ed Eva.",
      "Serpente avvolto all'albero della conoscenza (un secondo albero, diverso)."
    ],
    figure: [
      { nome: "Albero della vita (STESSO modello della tappa 23)", misura: "alto 6 cm, chioma Ø 4 cm", qta: 1 },
      { nome: "Albero della conoscenza", misura: "alto 4,5 cm", qta: 1 },
      { nome: "Adamo ed Eva", misura: "1 cm", qta: 2 },
      { nome: "Serpente", misura: "lungo 1,5 cm", qta: 1 },
      { nome: "Animali (leone, agnello, cervo, uccelli)", misura: "3-5 mm", qta: 12 }
    ] },

  { n: 3, nome: "Caino e Abele", sotto: "Due altari", zona: "origini", x: 105, y: 420,
    rif: "Genesi 4,1-16",
    storia: "Caino coltiva la terra, Abele pascola le greggi. Entrambi offrono un sacrificio: il fumo di Abele sale dritto, quello di Caino no. Caino uccide il fratello.",
    costruisci: [
      "Due piccoli altari di pietra, uno accanto all'altro.",
      "Sopra quello di Abele: fumo che sale dritto (filo di ovatta grigia).",
      "Campo arato da un lato, gregge dall'altro.",
      "Qui il sentiero curva e comincia a SALIRE verso l'Ararat."
    ],
    figure: [
      { nome: "Altari di pietra", misura: "1 x 1 x 0,8 cm", qta: 2 },
      { nome: "Caino e Abele", misura: "1 cm", qta: 2 },
      { nome: "Pecore", misura: "4 mm", qta: 8 }
    ] },

  { n: 4, nome: "Diluvio e Ararat", sotto: "L'arca sul monte", zona: "origini", x: 195, y: 150,
    rif: "Genesi 6-9",
    storia: "Dio manda il diluvio; Noè costruisce l'arca e vi fa entrare la sua famiglia e gli animali, a coppie. Quando le acque calano l'arca si posa sui monti dell'Ararat e appare l'arcobaleno.",
    costruisci: [
      "Il monte più ALTO del diorama: 12-15 cm di schiuma.",
      "Il sentiero sale sul fianco del monte: lungo la salita, animali in fila a coppie.",
      "Arca sulla cima (300 x 50 x 30 cubiti = 9 x 1,5 x 1 cm).",
      "Facoltativo: arcobaleno in filo di ferro dipinto, arco alto 5 cm."
    ],
    figure: [
      { nome: "Arca di Noè", misura: "9 x 1,5 x 1 cm", qta: 1 },
      { nome: "Noè e famiglia", misura: "1 cm", qta: 8 },
      { nome: "Coppie di animali (elefanti 8 mm, giraffe 1 cm, altri 3-5 mm)", misura: "3-10 mm", qta: 30 },
      { nome: "Colomba con ramoscello", misura: "3 mm", qta: 1 }
    ] },

  { n: 5, nome: "Torre di Babele", sotto: "La divisione dei popoli", zona: "origini", x: 290, y: 95,
    rif: "Genesi 11,1-9",
    storia: "Gli uomini vogliono costruire una torre che arrivi al cielo. Dio confonde le loro lingue e li disperde su tutta la terra.",
    costruisci: [
      "Torre a gradoni (ziggurat) a spirale, alta 6-7 cm, incompleta in cima.",
      "Impalcature in stuzzicadenti, mattoni sparsi.",
      "Gruppetti di persone che se ne vanno in direzioni diverse.",
      "Il sentiero qui RISCENDE."
    ],
    figure: [
      { nome: "Torre di Babele", misura: "base 4,5 x 4,5 cm, alta 6-7 cm", qta: 1 },
      { nome: "Costruttori e popoli", misura: "1 cm", qta: 15 },
      { nome: "Carretti di mattoni", misura: "8 mm", qta: 2 }
    ] },

  { n: 6, nome: "Abramo", sotto: "La prima promessa", zona: "patriarchi", x: 300, y: 200,
    rif: "Genesi 12,1-3; 15,5",
    storia: "Dio chiama Abramo a lasciare la sua terra e gli promette una discendenza numerosa come le stelle del cielo.",
    costruisci: [
      "Grande tenda nomade illuminata dall'interno (LED bianco caldo).",
      "Abramo fuori dalla tenda che guarda in alto.",
      "Greggi, cammelli, servi: un vero accampamento.",
      "Cielo stellato: puntini dorati sul terreno scuro attorno o sullo sfondo."
    ],
    figure: [
      { nome: "Tenda grande", misura: "3 x 2 x 1,5 cm", qta: 1 },
      { nome: "Tende piccole", misura: "1,5 x 1 cm", qta: 3 },
      { nome: "Abramo e Sara", misura: "1 cm", qta: 2 },
      { nome: "Cammelli", misura: "1,2 cm", qta: 4 },
      { nome: "Pecore e capre", misura: "4 mm", qta: 12 }
    ], luce: "bianco caldo" },

  { n: 7, nome: "Sodoma e Gomorra", sotto: "La moglie di Lot", zona: "patriarchi", x: 290, y: 305,
    rif: "Genesi 19,15-26",
    storia: "Gli angeli fanno fuggire Lot e la sua famiglia prima della distruzione delle città. La moglie di Lot si volta indietro e diventa una statua di sale.",
    costruisci: [
      "Case in rovina annerite, con fiamme (LED arancioni tremolanti).",
      "Lot e le figlie che fuggono lungo il sentiero.",
      "Statua di sale BIANCA, girata verso la città."
    ],
    figure: [
      { nome: "Case in rovina", misura: "1,5 x 1,5 cm", qta: 5 },
      { nome: "Statua di sale (moglie di Lot)", misura: "1 cm, bianco", qta: 1 },
      { nome: "Lot, figlie, due angeli", misura: "1 cm", qta: 5 }
    ], luce: "fuoco tremolante" },

  { n: 8, nome: "I Patriarchi", sotto: "Isacco, Giacobbe, i dodici figli", zona: "patriarchi", x: 310, y: 420,
    rif: "Genesi 22; 28,10-19; 35,22-26",
    storia: "Isacco, figlio della promessa. Giacobbe sogna una scala che va dalla terra al cielo, con gli angeli che salgono e scendono. Da Giacobbe nascono dodici figli, padri delle dodici tribù.",
    costruisci: [
      "Giacobbe che dorme con la testa su una pietra.",
      "Scala in verticale (filo di ottone o stampa 3D) con angeli bianchi.",
      "I dodici figli in cerchio, tende e pozzo."
    ],
    figure: [
      { nome: "Scala di Giacobbe", misura: "alta 5 cm, larga 8 mm", qta: 1 },
      { nome: "Angeli", misura: "8 mm", qta: 4 },
      { nome: "Giacobbe sdraiato", misura: "1 cm", qta: 1 },
      { nome: "Dodici figli", misura: "1 cm", qta: 12 },
      { nome: "Tende", misura: "1,5 cm", qta: 2 }
    ], luce: "bianco caldo" },

  { n: 9, nome: "Giuseppe in Egitto", sotto: "Piramidi, pozzo, granai, Nilo", zona: "patriarchi", x: 395, y: 400,
    rif: "Genesi 37; 41",
    storia: "Giuseppe, venduto dai fratelli e gettato in un pozzo, diventa viceré d'Egitto. Riempie i granai negli anni di abbondanza e salva tutti durante la carestia.",
    costruisci: [
      "Due o tre piramidi.",
      "Il fiume della vita qui diventa il NILO: canne e papiri sulle rive.",
      "Pozzo rotondo, granai a cupola, carovana di mercanti."
    ],
    figure: [
      { nome: "Piramidi", misura: "base 3 cm, alta 2 cm", qta: 3 },
      { nome: "Granai a cupola", misura: "Ø 1 cm", qta: 4 },
      { nome: "Pozzo", misura: "Ø 1 cm", qta: 1 },
      { nome: "Giuseppe, fratelli, egiziani", misura: "1 cm", qta: 12 },
      { nome: "Papiri", misura: "1,5 cm", qta: 10 }
    ], luce: "bianco caldo" },

  { n: 10, nome: "Esodo", sotto: "Roveto, piaghe, Mar Rosso", zona: "patriarchi", x: 405, y: 285,
    rif: "Esodo 3; 7-12; 14",
    storia: "Dio parla a Mosè da un roveto che arde senza consumarsi. Dopo le piaghe, il popolo esce dall'Egitto e attraversa il Mar Rosso all'asciutto.",
    costruisci: [
      "Roveto ardente con LED arancione tremolante.",
      "Mar Rosso APERTO: due muri d'acqua (resina o silicone trasparente) e il sentiero in mezzo.",
      "Il popolo in fila che attraversa, Mosè col bastone davanti."
    ],
    figure: [
      { nome: "Roveto", misura: "Ø 1,5 cm", qta: 1 },
      { nome: "Mosè col bastone", misura: "1 cm", qta: 1 },
      { nome: "Popolo in cammino", misura: "1 cm", qta: 20 },
      { nome: "Rane / cavallette (piaghe)", misura: "2-3 mm", qta: 10 }
    ], luce: "fuoco tremolante" },

  { n: 11, nome: "Sinai e deserto", sotto: "Tavole, vitello, tenda", zona: "patriarchi", x: 400, y: 150,
    rif: "Esodo 20; 32; 40; Numeri 21,8-9",
    storia: "Sul Sinai Dio dà a Mosè le tavole della legge. Il popolo costruisce un vitello d'oro. Nel deserto si erige la tenda del convegno; Mosè innalza il serpente di bronzo.",
    costruisci: [
      "Monte Sinai alto 8-10 cm, roccioso, con Mosè e le tavole in cima.",
      "Ai piedi: il vitello d'oro su un piedistallo, con il popolo intorno.",
      "Tenda del convegno con il recinto (cortile).",
      "Asta con il serpente di bronzo."
    ],
    figure: [
      { nome: "Tavole della legge", misura: "8 x 6 mm", qta: 1 },
      { nome: "Vitello d'oro", misura: "8 mm", qta: 1 },
      { nome: "Tenda del convegno con recinto", misura: "4 x 2 cm", qta: 1 },
      { nome: "Serpente di bronzo su asta", misura: "alto 2 cm", qta: 1 },
      { nome: "Popolo", misura: "1 cm", qta: 15 }
    ], luce: "bianco caldo" },

  { n: 12, nome: "Gerico e i Giudici", sotto: "Mura, Gedeone, Sansone, Rut", zona: "re", x: 495, y: 85,
    rif: "Giosuè 6; Giudici 7; 16; Rut 2",
    storia: "Le mura di Gerico crollano al suono delle trombe. Gedeone vince con trecento uomini; Sansone abbatte le colonne. Rut spigola nei campi di Booz.",
    costruisci: [
      "Cerchio di mura con un tratto CROLLATO.",
      "Sacerdoti con le trombe.",
      "Campo di grano dorato con Rut che raccoglie le spighe.",
      "Sansone tra due colonne spezzate."
    ],
    figure: [
      { nome: "Mura di Gerico (anello)", misura: "Ø 5 cm, alte 1,2 cm", qta: 1 },
      { nome: "Sacerdoti con trombe", misura: "1 cm", qta: 7 },
      { nome: "Colonne spezzate", misura: "alte 1,5 cm", qta: 2 },
      { nome: "Rut, Booz, mietitori", misura: "1 cm", qta: 5 }
    ] },

  { n: 13, nome: "Samuele e i re", sotto: "Saul, Davide e Golia", zona: "re", x: 490, y: 190,
    rif: "1 Samuele 3; 10; 17",
    storia: "Samuele unge Saul primo re. Il giovane pastore Davide affronta il gigante Golia con una fionda e una pietra.",
    costruisci: [
      "Due schieramenti su due colline, una valle in mezzo.",
      "Golia GRANDE (il doppio delle altre figure) e Davide piccolo con la fionda.",
      "Tenda di Saul."
    ],
    figure: [
      { nome: "Golia", misura: "2 cm", qta: 1 },
      { nome: "Davide con fionda", misura: "1 cm", qta: 1 },
      { nome: "Soldati", misura: "1 cm", qta: 16 },
      { nome: "Tenda reale", misura: "2 x 1,5 cm", qta: 1 }
    ], luce: "bianco caldo" },

  { n: 14, nome: "Salomone e il Tempio", sotto: "Gerusalemme", zona: "re", x: 500, y: 300,
    rif: "1 Re 6-8",
    storia: "Salomone costruisce a Gerusalemme il Tempio del Signore, splendente di pietra e d'oro.",
    costruisci: [
      "Collina di Sion; mura della città con porte.",
      "Tempio bianco e oro (5 x 3 cm) con il cortile e le due colonne all'ingresso.",
      "LED bianco caldo dentro il Tempio."
    ],
    figure: [
      { nome: "Tempio di Salomone", misura: "5 x 3 cm, alto 2,5 cm", qta: 1 },
      { nome: "Case di Gerusalemme", misura: "1-1,5 cm", qta: 10 },
      { nome: "Salomone e sacerdoti", misura: "1 cm", qta: 6 }
    ], luce: "bianco caldo" },

  { n: 15, nome: "Regno diviso e profeti", sotto: "Elia sul Carmelo, Giona", zona: "re", x: 490, y: 415,
    rif: "1 Re 18; Giona 1-2",
    storia: "Sul monte Carmelo il fuoco del cielo scende sull'altare di Elia. Giona fugge in mare e viene inghiottito da un grande pesce.",
    costruisci: [
      "Collina del Carmelo con altare e fuoco (LED arancione tremolante).",
      "Piccolo specchio di mare (resina) con il grande pesce e Giona."
    ],
    figure: [
      { nome: "Altare di Elia con legna", misura: "1,5 x 1 cm", qta: 1 },
      { nome: "Elia e profeti di Baal", misura: "1 cm", qta: 8 },
      { nome: "Grande pesce", misura: "3 cm", qta: 1 },
      { nome: "Barchetta", misura: "2 cm", qta: 1 }
    ], luce: "fuoco tremolante" },

  { n: 16, nome: "Deportazioni", sotto: "Assiria, Babilonia, Daniele", zona: "re", x: 590, y: 410,
    rif: "2 Re 17; 25; Daniele 6",
    storia: "Il popolo viene deportato in Assiria e poi a Babilonia. Daniele viene gettato nella fossa dei leoni, ma Dio lo salva.",
    costruisci: [
      "Porta di Babilonia azzurra (come la porta di Ishtar).",
      "Fila di prigionieri incatenati lungo il sentiero.",
      "Fossa rotonda scavata nella schiuma con i leoni e Daniele in mezzo."
    ],
    figure: [
      { nome: "Porta di Babilonia", misura: "3 x 1 cm, alta 2,5 cm", qta: 1 },
      { nome: "Leoni", misura: "6 mm", qta: 5 },
      { nome: "Daniele", misura: "1 cm", qta: 1 },
      { nome: "Prigionieri e soldati", misura: "1 cm", qta: 12 }
    ] },

  { n: 17, nome: "Ritorno e ricostruzione", sotto: "Le mura di Gerusalemme", zona: "re", x: 600, y: 300,
    rif: "Esdra 1-3; Neemia 2-6",
    storia: "Il popolo torna dall'esilio. Sotto la guida di Neemia ricostruisce le mura di Gerusalemme, con la cazzuola in una mano e la spada nell'altra.",
    costruisci: [
      "Tratto di mura in costruzione: metà alte, metà appena iniziate.",
      "Impalcature, pietre sparse, persone che portano blocchi.",
      "Qualche casa illuminata."
    ],
    figure: [
      { nome: "Mura (moduli)", misura: "3 x 0,5 x 1,5 cm", qta: 3 },
      { nome: "Blocchi di pietra", misura: "3 mm", qta: 20 },
      { nome: "Muratori, Neemia", misura: "1 cm", qta: 10 }
    ], luce: "bianco caldo" },

  { n: 18, nome: "Nascita di Gesù", sotto: "Stalla, stella, pastori, magi", zona: "vangeli", x: 600, y: 190,
    rif: "Luca 2,1-20; Matteo 2,1-12",
    storia: "A Betlemme nasce Gesù e viene deposto in una mangiatoia. Gli angeli lo annunciano ai pastori; i magi seguono la stella.",
    costruisci: [
      "Stalla/grotta con Maria, Giuseppe e il Bambino (LED bianco caldo).",
      "Stella cometa sopra la stalla (LED su filo).",
      "Pastori e greggi tutto intorno, magi con i cammelli che arrivano lungo il sentiero."
    ],
    figure: [
      { nome: "Stalla", misura: "3 x 2 cm, alta 2 cm", qta: 1 },
      { nome: "Sacra Famiglia, bue e asinello", misura: "1 cm (Bambino 4 mm)", qta: 5 },
      { nome: "Magi e cammelli", misura: "1-1,2 cm", qta: 6 },
      { nome: "Pastori", misura: "1 cm", qta: 6 },
      { nome: "Pecore", misura: "4 mm", qta: 15 }
    ], luce: "bianco caldo + stella" },

  { n: 19, nome: "Ministero di Gesù", sotto: "Galilea, pani e pesci, Gerusalemme", zona: "vangeli", x: 630, y: 80,
    rif: "Marco 6,30-44; Matteo 21,1-11",
    storia: "Sul lago di Galilea Gesù chiama i pescatori. Moltiplica cinque pani e due pesci per la folla. Entra a Gerusalemme su un asinello tra le palme.",
    costruisci: [
      "Laghetto di Galilea (resina) con una barca da pesca.",
      "Folla seduta sull'erba con le ceste di pane.",
      "Lungo il sentiero: Gesù sull'asinello e gente con rami di palma."
    ],
    figure: [
      { nome: "Barca di pescatori", misura: "2 cm", qta: 1 },
      { nome: "Ceste", misura: "4 mm", qta: 12 },
      { nome: "Gesù sull'asinello", misura: "1,2 cm", qta: 1 },
      { nome: "Folla e discepoli", misura: "1 cm", qta: 25 }
    ] },

  { n: 20, nome: "Croce e risurrezione", sotto: "Tre croci, sepolcro vuoto", zona: "vangeli", x: 720, y: 115,
    rif: "Luca 23,33-24,12",
    storia: "Gesù viene crocifisso sul Calvario tra due ladroni. Il terzo giorno le donne trovano la pietra rotolata e il sepolcro vuoto.",
    costruisci: [
      "Collinetta del Golgota con tre croci (quella centrale più alta).",
      "Sepolcro scavato nella roccia, con la pietra rotonda rotolata via.",
      "Donne e un angelo bianco davanti al sepolcro."
    ],
    figure: [
      { nome: "Croci", misura: "alte 2,5 cm (centrale 3 cm)", qta: 3 },
      { nome: "Sepolcro", misura: "2 x 1,5 cm", qta: 1 },
      { nome: "Pietra rotonda", misura: "Ø 1,2 cm", qta: 1 },
      { nome: "Donne, angelo, soldati", misura: "1 cm", qta: 6 }
    ] },

  { n: 21, nome: "Pentecoste", sotto: "Il cenacolo e lo Spirito", zona: "vangeli", x: 715, y: 225,
    rif: "Atti 2,1-13",
    storia: "Gli apostoli sono riuniti con Maria. Scende lo Spirito Santo come lingue di fuoco e cominciano ad annunciare il Vangelo a tutti i popoli.",
    costruisci: [
      "Casa con il tetto aperto (cenacolo) e una luce calda dentro.",
      "Dodici fiammelle sopra le teste (perline arancioni o LED).",
      "Folla di popoli diversi davanti alla casa."
    ],
    figure: [
      { nome: "Cenacolo", misura: "3 x 2,5 cm", qta: 1 },
      { nome: "Apostoli e Maria", misura: "1 cm", qta: 13 },
      { nome: "Fiammelle", misura: "3 mm", qta: 13 },
      { nome: "Folla", misura: "1 cm", qta: 10 }
    ], luce: "bianco caldo" },

  { n: 22, nome: "Viaggi di Paolo", sotto: "Damasco e il Mediterraneo", zona: "vangeli", x: 700, y: 330,
    rif: "Atti 9,1-9; 27",
    storia: "Sulla via di Damasco una luce dal cielo fa cadere Saulo, che diventa Paolo. Poi viaggia per mare per portare il Vangelo fino a Roma.",
    costruisci: [
      "Tratto di strada con Paolo caduto da cavallo e un raggio di luce.",
      "Lungo il bordo destro: un tratto di Mar Mediterraneo (resina blu) con una piccola nave."
    ],
    figure: [
      { nome: "Nave di Paolo", misura: "3 cm", qta: 1 },
      { nome: "Paolo e cavallo", misura: "1 cm / 1,3 cm", qta: 2 },
      { nome: "Compagni di viaggio", misura: "1 cm", qta: 5 }
    ] },

  { n: 23, nome: "Apocalisse", sotto: "La Nuova Gerusalemme", zona: "vangeli", x: 735, y: 435,
    rif: "Apocalisse 21-22",
    storia: "Giovanni vede la Nuova Gerusalemme scendere dal cielo, splendente come oro puro, con dodici porte. In mezzo scorre il fiume dell'acqua della vita e c'è l'albero della vita.",
    costruisci: [
      "Città quadrata dorata (9 x 9 cm) con 12 porte, 3 per lato.",
      "Striscia LED tutto intorno: deve essere il punto più luminoso.",
      "Qui il fiume ARRIVA sotto l'albero della vita (stampa identica alla tappa 2).",
      "Sotto la città è nascosta la vaschetta con la pompa: il tetto/piazza si toglie per l'ispezione."
    ],
    figure: [
      { nome: "Albero della vita (STESSO modello della tappa 2)", misura: "alto 6 cm, chioma Ø 4 cm", qta: 1 },
      { nome: "Mura della città con 12 porte", misura: "9 x 9 cm, alte 1,5 cm", qta: 1 },
      { nome: "Popoli in festa", misura: "1 cm", qta: 20 }
    ], luce: "striscia LED" },
];

// ---------------------------------------------------------
// LE 14 FASI DI COSTRUZIONE
// ---------------------------------------------------------
const FASI = [
  { n: 1, titolo: "Progetto su carta",
    breve: "Disegni in scala il percorso, le caselle e il fiume prima di toccare il legno.",
    materiali: ["Foglio di carta grande (o 4 fogli A3 uniti con lo scotch)", "Matita morbida e gomma", "Pennarello blu"],
    attrezzi: ["Righello lungo o metro da sarta", "Squadra", "Compasso"],
    passi: [
      "Disegna un rettangolo 80 x 50 cm (o in scala 1:2, cioè 40 x 25 cm).",
      "Fai una griglia di 10 x 10 cm: ti servirà per riportare tutto sul legno.",
      "Segna le 23 caselle (quadrati da 7,5 cm) nella posizione che vedi sul tabellone.",
      "Collega le caselle con il sentiero a saliscendi: alto a sinistra → basso a destra.",
      "Disegna in blu il fiume dall'Eden (tappa 2) alla Nuova Gerusalemme (tappa 23).",
      "Segna dove il fiume incrocia il sentiero: lì andranno 5 ponticelli.",
      "Segna i monti: Ararat (il più alto), Sinai, Carmelo, Golgota, colline."
    ],
    misure: ["Tabellone 800 x 500 mm", "Caselle 75 x 75 mm", "Sentiero largo circa 35 mm", "Fiume largo 5-10 mm"],
    consigli: ["Il fiume deve SEMPRE scendere: segna accanto a ogni tratto un'altezza (Eden 60 mm → Nuova Gerusalemme 10 mm).", "Fai una foto al disegno: lo userai spesso."] },

  { n: 2, titolo: "Preparazione della base",
    breve: "Tagli il pannello, lo rinforzi sotto con dei listelli e lo sollevi da terra.",
    materiali: ["Pannello multistrato 80 x 50 cm, spessore 12-15 mm", "4 listelli di legno 30 x 60 mm (2 da 80 cm, 2 da 44 cm)", "Colla vinilica", "Viti per legno 3,5 x 40 mm", "Primer / fondo per legno"],
    attrezzi: ["Seghetto o fai tagliare il pannello in falegnameria", "Avvitatore", "Carta vetrata grana 120", "Pennello largo"],
    passi: [
      "Fai tagliare il pannello 80 x 50 cm (molti negozi di bricolage lo tagliano gratis).",
      "Carteggia i bordi e gli spigoli.",
      "Incolla e avvita i listelli SOTTO, lungo i bordi, messi \"di coltello\" (in piedi sul lato da 6 cm): fanno da telaio e da piedini.",
      "Così la base resta sollevata di 6 cm: spazio per vaschetta, tubo e cavi.",
      "Dai una mano di fondo sulla faccia superiore (la schiuma attacca meglio e il legno non beve acqua).",
      "Riporta la griglia 10 x 10 cm e il disegno del percorso a matita sul legno."
    ],
    misure: ["Spessore pannello 12-15 mm", "Altezza sotto la base: 60 mm (listelli di coltello)", "Peso finale previsto: 6-9 kg"],
    consigli: ["Il multistrato si imbarca meno del compensato economico: vale la spesa.", "La vaschetta è alta 5 cm: con 6 cm di spazio sotto ci sta comoda e si sfila."] },

  { n: 3, titolo: "Fori, tubi, vaschetta, pompa e cavi",
    breve: "Prepari tutto ciò che passa SOTTO la base, prima che la schiuma copra i punti di passaggio.",
    materiali: ["Pompa a immersione per presepe 12 V, marchio CE, con regolatore di portata", "Vaschetta di plastica alimentare circa 12 x 8 x 5 cm (0,4 L)", "Tubo in silicone Ø 6-8 mm, circa 1,5 m", "Fascette fermatubo e graffette a U", "Colla epossidica bicomponente", "Tubetti di plastica (cannucce rigide) per i passaggi dei cavi"],
    attrezzi: ["Trapano con punte da legno 8 e 10 mm", "Seghetto alternativo (per il foro della vaschetta)", "Matita, metro"],
    passi: [
      "Sotto la Nuova Gerusalemme taglia un foro rettangolare 8 x 6 cm (più piccolo della città, che è 9 x 9 cm, così resta nascosto).",
      "Sotto il foro avvita due guide (listellini a L): la vaschetta 12 x 8 cm ci scorre dentro e si può SFILARE per pulirla.",
      "Nell'Eden, sotto l'albero della vita, fai un foro da 8-10 mm: qui risale l'acqua (sorgente).",
      "Fai passare il tubo in silicone sotto la base, dalla pompa alla sorgente, fissandolo con graffette.",
      "Incolla con epossidica un pezzetto di tubo rigido nel foro della sorgente: sporgerà 5-6 cm (l'altezza dell'Eden).",
      "Fai i fori da 8 mm per i cavi delle luci (tende, Tempio, fuochi…) e mettici dentro una cannuccia.",
      "Fai passare il cavo della pompa verso il bordo destro, dove starà l'alimentatore FUORI dalla base."
    ],
    misure: ["Foro sotto la città 80 x 60 mm", "Foro sorgente Ø 8-10 mm", "Tubo Ø interno 6-8 mm", "Fori cavi Ø 8 mm"],
    consigli: ["Prova SUBITO la pompa in un secchio: deve spingere l'acqua fino a 10 cm di altezza.", "Lascia 20 cm di tubo in più: meglio tagliare dopo che restare corti."],
    attenzione: "La pompa non deve mai girare a secco: si rovina." },

  { n: 4, titolo: "Terreno in schiuma e montagne",
    breve: "Spruzzi la schiuma poliuretanica a strati e la scolpisci: Ararat altissimo, Sinai, colline.",
    materiali: ["Schiuma poliuretanica espandente: 4-6 bombolette da 750 ml", "Pezzi di polistirolo o cartone per fare volume nei monti", "Nastro adesivo di carta"],
    attrezzi: ["Guanti in nitrile, occhiali, mascherina", "Taglierino con lame lunghe (da cambiare spesso)", "Seghetto per pane", "Raspa / carta vetrata grossa"],
    passi: [
      "Proteggi con nastro di carta i fori dei cavi e il tubo della sorgente.",
      "Incolla blocchi di polistirolo dove andranno i monti: risparmi schiuma.",
      "Spruzza la schiuma a strati sottili (2-3 cm alla volta): si gonfia molto!",
      "Aspetta che indurisca (almeno 8-12 ore, meglio un giorno).",
      "Scolpisci col taglierino e il seghetto: Ararat 12-15 cm, Sinai 8-10 cm, Eden altopiano 5-6 cm, colline 2-4 cm.",
      "Lascia la Nuova Gerusalemme bassa (circa 1 cm): è il punto d'arrivo dell'acqua.",
      "Spiana le caselle: devono essere piatte, come terrazzini."
    ],
    misure: ["Ararat 120-150 mm", "Sinai 80-100 mm", "Eden 50-60 mm", "Colline 20-40 mm", "Nuova Gerusalemme 10 mm"],
    consigli: ["Lavora all'aperto o con le finestre aperte.", "Meglio poca schiuma più volte che tanta in una volta: si deforma."],
    attenzione: "La schiuma fresca si attacca alla pelle e non va via: usa sempre i guanti." },

  { n: 5, titolo: "Scavo del fiume e del sentiero",
    breve: "Incidi il letto del fiume (in leggera discesa) e il sentiero che collega le caselle.",
    materiali: ["Canaletta di plastica trasparente (o tubo trasparente tagliato a metà) per i salti"],
    attrezzi: ["Taglierino", "Cucchiaino o scavino", "Livella piccola o una biglia (per verificare la pendenza)"],
    passi: [
      "Ridisegna il fiume con un pennarello sulla schiuma.",
      "Incidi a griglia: tagli paralleli profondi 1 cm, poi tagli di traverso, poi togli i quadratini.",
      "Il letto deve essere largo 8-12 mm e profondo 8-10 mm (diventerà 5-10 mm dopo il gesso).",
      "Controlla che SCENDA sempre: una biglia appoggiata nel letto deve rotolare verso la Nuova Gerusalemme.",
      "Nei salti (cascatelle) scava più profondo al centro prima del salto e inserisci la canaletta trasparente.",
      "Scava il sentiero: largo 35 mm, profondo 3-5 mm, con un leggero bordo rialzato.",
      "Nei 5 punti dove il fiume incrocia il sentiero lascia lo spazio per i ponticelli."
    ],
    misure: ["Letto fiume 8-12 mm x 8-10 mm", "Pendenza minima 2%", "Salti: 4 cascatelle da 5-10 mm", "Sentiero 35 mm"],
    consigli: ["Altezze del fiume: Eden 60 → Ararat 45 → Egitto 30 → Re 20 → Nuova Gerusalemme 10 mm.", "Le curve larghe fanno scorrere meglio l'acqua."] },

  { n: 6, titolo: "Gesso, segatura e impermeabilizzazione",
    breve: "Copri la schiuma con gesso e segatura, poi rendi il fiume a tenuta stagna.",
    materiali: ["Gesso scagliola (2-3 kg)", "Segatura fine", "Colla vinilica", "Gomma liquida impermeabilizzante", "Colla epossidica (punti dei tubi)", "Garze o carta igienica (per rinforzare)"],
    attrezzi: ["Ciotola e spatola", "Pennelli vecchi", "Spruzzino d'acqua"],
    passi: [
      "Mescola gesso + acqua + un cucchiaio di vinilica + segatura (consistenza yogurt).",
      "Stendi su tutto il terreno con pennello e spatola: 2-3 mm. Picchietta per dare l'effetto roccia.",
      "Nel fiume e nei salti stendi gesso liscio, senza segatura.",
      "Lascia asciugare 24-48 ore.",
      "Dai 2-3 mani di gomma liquida DENTRO il letto del fiume, salendo 5 mm sui bordi.",
      "Sigilla con colla epossidica i punti dove arrivano o partono i tubi (sorgente e vaschetta) e le canalette dei salti."
    ],
    misure: ["Strato di gesso 2-3 mm", "Gomma liquida: 3 mani, 4-6 ore tra una e l'altra"],
    consigli: ["Lavora a piccole zone: il gesso indurisce in 10-15 minuti.", "La segatura dà una texture bellissima al terreno dopo il colore."] },

  { n: 7, titolo: "Test dell'acqua",
    breve: "Fai scorrere l'acqua per qualche ora PRIMA di dipingere: è il momento di trovare le perdite.",
    materiali: ["Acqua demineralizzata (2 L)", "Carta assorbente", "Silicone trasparente (per eventuali riparazioni)"],
    attrezzi: ["Alimentatore 12 V della pompa", "Brocca", "Torcia"],
    passi: [
      "Riempi la vaschetta con acqua demineralizzata fino a coprire bene la pompa.",
      "Accendi la pompa con la portata al MINIMO.",
      "Controlla che l'acqua esca dalla sorgente nell'Eden e scenda fino alla Nuova Gerusalemme.",
      "Aumenta piano la portata finché il fiume è pieno ma non trabocca.",
      "Lascia girare 2-3 ore e controlla sotto la base con la torcia: nessuna goccia!",
      "Segna le perdite con una matita, asciuga, ripara con gomma liquida o silicone e ripeti il test."
    ],
    misure: ["Portata: la più bassa che riempie il fiume", "Durata test: almeno 2-3 ore"],
    consigli: ["Se l'acqua trabocca in curva, alza il bordo esterno con un filo di silicone.", "Quando spegni la pompa l'acqua torna nella vaschetta: lascia un po' di spazio libero."],
    attenzione: "Pompa e luci SOLO a 12 V. L'alimentatore resta fuori dalla base, lontano dall'acqua." },

  { n: 8, titolo: "Colori del terreno per zone",
    breve: "Dipingi il terreno a zone che raccontano la storia, poi la resina nel fiume.",
    materiali: ["Acrilici: verde, blu, ocra, terra di Siena, sabbia, grigio pietra, bianco, oro", "Resina epossidica trasparente per il fiume", "Silicone trasparente e sigillante acrilico per le rifiniture"],
    attrezzi: ["Pennelli piatti e tondi", "Spugnetta", "Pennello a secco (dry brush)", "Bicchierini e stecchini per la resina"],
    passi: [
      "Fai una base scura su tutto (terra bruciata diluita).",
      "Origini (tappe 1-5): verdi e blu. Patriarchi ed Esodo (6-11): sabbia e ocra.",
      "Re e Profeti (12-17): grigio pietra e tocchi d'oro. Vangeli e Apocalisse (18-23): bianco, crema e luce.",
      "Sfuma i confini tra le zone con la spugnetta: niente linee nette.",
      "Pennello a secco con colori chiari sulle rocce: escono i rilievi.",
      "Sentiero color sabbia, caselle leggermente più chiare.",
      "Fondo del fiume: blu scuro al centro, verde-marrone sui bordi.",
      "Stendi la resina epossidica nel letto del fiume in strato sottile (2 mm). Rifinisci i bordi con silicone trasparente o sigillante acrilico."
    ],
    misure: ["Resina: strato da 2 mm, 24 ore di asciugatura", "Zone: 1-5 / 6-11 / 12-17 / 18-23"],
    consigli: ["Dopo la resina ripeti il test dell'acqua per un'ora.", "Il colore schiarisce asciugando: provalo su un pezzo di scarto."] },

  { n: 9, titolo: "Impianto luci e test",
    breve: "Posizioni e colleghi i LED a 12 V, tutto sotto la base, e provi ogni luce prima di incollare.",
    materiali: ["Alimentatore 12 V (es. dal catalogo Frisa Presepi)", "LED bianco caldo 12 V (circa 12)", "LED tremolanti arancioni 12 V (circa 4)", "Striscia LED bianco caldo 12 V, 40 cm", "Cavetto bipolare rosso/nero", "Morsetti a leva o mammut, guaina termorestringente", "Facoltativo: centralina giorno/notte; Micro Light System"],
    attrezzi: ["Spelafili", "Saldatore (facoltativo)", "Tester (facoltativo)", "Nastro isolante"],
    passi: [
      "Infila ogni LED dal suo foro, con i cavetti che scendono sotto la base.",
      "Sotto, porta tutti i cavi verso un punto di raccolta vicino al bordo destro.",
      "Collega rosso con rosso (+) e nero con nero (−) con i morsetti.",
      "Fissa i cavi sotto la base con graffette o fascette, lontani dalla vaschetta.",
      "Collega l'alimentatore: resta FUORI dalla base.",
      "Accendi e controlla ogni luce, una per una. Solo dopo fissa i LED con una goccia di colla a caldo."
    ],
    misure: ["Tensione: SOLO 12 V", "Nessun cavo a 220 V dentro il diorama", "Striscia LED: 4 lati x 9 cm = 36-40 cm"],
    consigli: ["Bianco caldo per case, tende e Tempio; arancione tremolante per roveto, Carmelo, Sodoma.", "Con la centralina puoi avere alba, giorno, tramonto e notte."],
    attenzione: "Mai collegare cavi alla corrente di casa dentro il diorama. Spegni sempre prima di toccare i fili." },

  { n: 10, titolo: "Scene stampate in 3D",
    breve: "Incolli le costruzioni principali di ogni tappa, una alla volta, nell'ordine del percorso.",
    materiali: ["Le stampe 3D (vedi la scheda di ogni tappa)", "Primer spray grigio o bianco", "Acrilici", "Colla cianoacrilica (Attak) e colla a caldo", "5 ponticelli in legno o stampati (4 x 2 cm)"],
    attrezzi: ["Stampante 3D (PLA, layer 0,12 mm per le figure piccole)", "Pinzette", "Limette e taglierino per pulire le stampe"],
    passi: [
      "Stampa prima le costruzioni grandi: arca, torre, tempio, città, stalla.",
      "Togli i supporti, carteggia, dai il primer.",
      "Dipingi e lascia asciugare.",
      "Prova la posizione SENZA colla, poi incolla dalla tappa 1 alla 23.",
      "Le scene con le luci: infila prima il LED nella stampa, poi incolla.",
      "Incolla i 5 ponticelli dove il fiume incrocia il sentiero.",
      "I due alberi della vita (Eden e Nuova Gerusalemme) sono lo STESSO file stampato due volte."
    ],
    misure: ["Persone 1 cm", "Animali piccoli 3-5 mm", "Arca 9 x 1,5 x 1 cm", "Torre 6-7 cm", "Tempio 5 x 3 cm", "Nave 3 cm"],
    consigli: ["Lascia la piazza della Nuova Gerusalemme staccabile: sotto c'è la pompa.", "Stampa in bianco: dipingere è più facile."] },

  { n: 11, titolo: "Vegetazione, persone, animali",
    breve: "Riempi ogni spazio come in un presepe napoletano: folle, greggi, cammelli, accampamenti.",
    materiali: ["Erba statica e flock", "Muschio e licheni", "Palme e alberelli (stampati o comprati)", "Figure 1 cm e animali 3-5 mm in quantità (200+)", "Colla vinilica diluita"],
    attrezzi: ["Pennello vecchio", "Pinzette", "Setaccio da tè (per il flock)"],
    passi: [
      "Origini: prati verdi, fiori, animali di ogni tipo.",
      "Patriarchi ed Esodo: tende, cammelli, greggi, palme, carovane.",
      "Re e Profeti: case, ulivi, soldati, mercanti.",
      "Vangeli: pastori, pecore, folle, barche, palme.",
      "Riempi gli spazi tra le caselle: nessun angolo vuoto!",
      "Metti piccoli gruppi che 'raccontano': chi porta l'acqua, chi cucina, bambini che giocano."
    ],
    misure: ["Circa 200-300 figure in totale", "Erba statica 2-4 mm"],
    consigli: ["Lascia libero il sentiero: deve leggersi bene il percorso.", "Le figure lontane dal bordo possono essere più piccole: sembrano più lontane."] },

  { n: 12, titolo: "Targhette",
    breve: "Accanto a ogni tappa una targhetta con numero, nome e riferimento biblico.",
    materiali: ["Cartoncino avorio o targhette stampate in 3D", "Stampa delle etichette (vedi elenco tappe)", "Stuzzicadenti o spilli"],
    attrezzi: ["Forbici", "Colla"],
    passi: [
      "Stampa le etichette: numero, nome e riferimento (es. «4 · Diluvio · Gen 6-9»).",
      "Incollale su cartoncino o su targhette 3D (2,5 x 1 cm).",
      "Fissale su uno stuzzicadenti accanto a ogni casella, sempre dallo stesso lato del sentiero."
    ],
    misure: ["Targhetta 25 x 10 mm", "Testo 6-8 pt"],
    consigli: ["Usa un font semplice e leggibile.", "Un colore diverso per ogni zona aiuta a capire il percorso."] },

  { n: 13, titolo: "Sfondo (facoltativo)",
    breve: "Pannelli di compensato dietro e ai lati, dipinti con cielo e stelle.",
    materiali: ["Compensato 4 mm: 80 x 30 cm (retro) + 2 da 50 x 30 cm (lati)", "Acrilici blu notte, azzurro, bianco, oro", "Cerniere piccole o squadrette"],
    attrezzi: ["Spugna, spazzolino da denti (per le stelle a spruzzo)", "Avvitatore"],
    passi: [
      "Dipingi un cielo che va dall'alba (a sinistra, Genesi) alla notte stellata (centro) alla luce dorata (destra, Apocalisse).",
      "Stelle: intingi lo spazzolino nel bianco e passa il dito sulle setole.",
      "Fissa i pannelli dietro alla base con squadrette, così si possono smontare.",
      "Facoltativo: piccoli fori con LED a fibra ottica per le stelle."
    ],
    misure: ["Retro 800 x 300 mm", "Lati 500 x 300 mm (facoltativi)"],
    consigli: ["Lo sfondo fa sembrare il diorama molto più profondo.", "Puoi decidere dopo: la base funziona anche senza."] },

  { n: 14, titolo: "Prodotto finito",
    breve: "Ultimi controlli, pulizia, e il tuo diorama dalla Genesi all'Apocalisse è pronto!",
    materiali: ["Acqua demineralizzata", "Panno in microfibra", "Pennello morbido per la polvere"],
    attrezzi: [],
    passi: [
      "Riempi la vaschetta, accendi pompa e luci.",
      "Controlla che il fiume scorra dall'Eden alla Nuova Gerusalemme.",
      "Spegni la luce della stanza e ammira!",
      "Ogni tanto: rabbocca con acqua demineralizzata e togli la polvere con un pennello morbido."
    ],
    misure: ["80 x 50 cm, 23 tappe, 1 fiume della vita"],
    consigli: ["Spegni la pompa quando non c'è nessuno a guardare.", "Svuota e pulisci la vaschetta ogni 2-3 settimane."] },
];

// ---------------------------------------------------------
// LISTA MATERIALI COMPLETA (con le caselle da spuntare)
// ---------------------------------------------------------
const MATERIALI = [
  { gruppo: "Base e struttura", voci: [
    ["Pannello multistrato 80 x 50 cm, sp. 12-15 mm", "1"],
    ["Listelli di legno 30 x 60 mm", "2 da 80 cm + 2 da 44 cm"],
    ["Viti per legno 3,5 x 40 mm", "12"],
    ["Colla vinilica", "1 flacone"],
    ["Fondo/primer per legno", "250 ml"],
    ["Carta vetrata grana 120", "2 fogli"],
  ]},
  { gruppo: "Terreno", voci: [
    ["Schiuma poliuretanica espandente 750 ml", "4-6 bombolette"],
    ["Blocchi di polistirolo (riempimento monti)", "qualche pezzo"],
    ["Gesso scagliola", "2-3 kg"],
    ["Segatura fine", "1 sacchetto"],
    ["Nastro adesivo di carta", "1 rotolo"],
  ]},
  { gruppo: "Fiume della vita (acqua)", voci: [
    ["Pompa a immersione 12 V per presepe, marchio CE, con regolatore", "1"],
    ["Vaschetta in plastica ~12 x 8 x 5 cm", "1"],
    ["Tubo in silicone Ø 6-8 mm", "1,5 m"],
    ["Fascette fermatubo / graffette a U", "10"],
    ["Gomma liquida impermeabilizzante", "1 barattolo"],
    ["Colla epossidica bicomponente", "1 confezione"],
    ["Resina epossidica trasparente", "100-200 ml"],
    ["Silicone trasparente", "1 tubetto"],
    ["Sigillante acrilico", "1 tubetto"],
    ["Canaletta di plastica trasparente (per i salti)", "30 cm"],
    ["Acqua demineralizzata", "2 L"],
  ]},
  { gruppo: "Luci (solo 12 V)", voci: [
    ["Alimentatore 12 V (Frisa Presepi o simile)", "1"],
    ["LED bianco caldo 12 V", "12"],
    ["LED arancione tremolante 12 V (fuochi)", "4"],
    ["Striscia LED bianco caldo 12 V", "40 cm"],
    ["Cavetto bipolare rosso/nero", "5 m"],
    ["Morsetti a leva / mammut", "10"],
    ["Guaina termorestringente", "1 confezione"],
    ["Centralina alba/giorno/tramonto/notte (facoltativa)", "1"],
  ]},
  { gruppo: "Colori e rifiniture", voci: [
    ["Acrilici: verde, blu, ocra, terra di Siena, sabbia, grigio, bianco, nero, oro", "1 set"],
    ["Primer spray (per le stampe 3D)", "1 bomboletta"],
    ["Erba statica e flock", "2-3 colori"],
    ["Muschio e licheni", "1 busta"],
    ["Colla cianoacrilica", "1"],
    ["Colla a caldo + stick", "1"],
    ["Cartoncino avorio (targhette)", "1 foglio A4"],
  ]},
  { gruppo: "Stampa 3D", voci: [
    ["Filamento PLA bianco", "1 bobina (1 kg)"],
    ["Filamento PLA marrone/grigio (facoltativo)", "1 bobina"],
    ["Figure persone ~1 cm", "200+"],
    ["Animali 3-5 mm", "100+"],
    ["Albero della vita (stesso file)", "2"],
    ["Ponticelli 4 x 2 cm", "5"],
  ]},
  { gruppo: "Sfondo (facoltativo)", voci: [
    ["Compensato 4 mm 80 x 30 cm", "1"],
    ["Compensato 4 mm 50 x 30 cm (lati)", "2"],
    ["Squadrette metalliche", "4"],
  ]},
  { gruppo: "Attrezzi", voci: [
    ["Taglierino con lame di ricambio", "1"],
    ["Seghetto per pane / seghetto alternativo", "1"],
    ["Trapano/avvitatore con punte da legno 8-10 mm", "1"],
    ["Pennelli assortiti e spugnette", "1 set"],
    ["Spelafili", "1"],
    ["Guanti in nitrile, occhiali, mascherina", "1 set"],
    ["Righello lungo, squadra, metro", "1"],
  ]},
];
