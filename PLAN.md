# Solvo: suunnitelma (Junction 2026, S-Pankki Personal Economic Trainer)

*Solvo on latinaa ja tarkoittaa "irrotan, vapautan" sekä "maksan velan". Tagline: Fixed costs aren't fixed. Tiimi: Pietu ja Topias. Versio 2, pe 13.11. klo 20.45. Draft on lähetetty.*

## Yhdellä lauseella
Talousvalmentaja, joka ei vain kerro mihin rahasi menivät, vaan **pienentää kiinteitä kulujasi**: se lukee pankkiin jo tulevat e-laskusi, kertoo paljonko maksat liikaa ja kilpailuttaa sopimuksen puolestasi sinun hyväksynnälläsi. Käyttäjän ei tarvitse kuvata tai ladata mitään.

## Ongelma (S-Pankin omasta datasta)
- S-Pankin datassa 5 100 asiakkaalla on Utilities-maksuja keskimäärin **noin 2 000 € vuodessa** (mediaani noin 1 900 €), mutta näillä maksuilla **ei ole kauppiasta eikä toimialakoodia**. Pankki näkee summan, mutta ei tiedä, mistä sopimuksesta on kyse tai onko se hyvä.
- Kiinteät kulut tuntuvat ihmisistä "kiinteiltä", joten niitä ei koskaan kilpailuteta. Sopimukset jatkuvat huonommilla ehdoilla, koska kukaan ei muista päättymispäivää.
- Vertailusivustoja on olemassa (esim. Kilpailuttaja ja Sähkövertailu), mutta ne ovat kertaluonteisia. Kukaan ei seuraa sopimuksia jatkuvasti.

## Ratkaisu: kolme koria, joista yksi korjataan
S-Pankin haasteen kolme koria ovat demon runko:
1. **Kiinteät säännölliset kulut** (asuminen, sähkö, puhelin ja netti). Tämä on meidän erikoisuutemme: e-laskun luku, sopimuksen tunnistus, vertailu ja vaihto.
2. **Kiinteät epäsäännölliset kulut** (terveys, matkat, kodin hankinnat). Valmentaja varaa niihin rahaa etukäteen.
3. **Arjen vuoto** (ravintolat, taksit, viihde). Valmentaja vastaa esimerkiksi kysymykseen "paljonko käytin takseihin?"

Kaikki tiivistyy yhteen lukuun: **"Paljonko voin turvallisesti käyttää tällä viikolla?"** Kun sopimus vaihdetaan, luku kasvaa näkyvästi.

## Demo 2 minuutissa (tärkein asia)
1. Avataan demo-asiakkaan sovellus. Näkyvissä ovat kolme koria ja turvallinen käyttöraha tältä viikolta. (S-Pankin oikea data.)
2. "Laskusi ovat 2 400 € vuodessa." Solvo on jo lukenut pankkiin tulleet e-laskut ja tunnistanut jokaisen sopimuksen.
3. Sähkösopimus avataan: tekoäly on poiminut e-laskusta myyjän, hinnan, perusmaksun, kulutuksen ja päättymispäivän. Käyttäjä ei tehnyt mitään.
4. Vertailu: "Maksat noin 240 € vuodessa liikaa. Jos et tee mitään, sopimus jatkuu 31.12. kalliimmalla hinnalla."
5. Vaihto yhdellä napautuksella **käyttäjän hyväksynnällä**. Turvallinen käyttöraha kasvaa, ja muistutus asetetaan ennen seuraavaa päättymistä.
6. Valmentaja-chat: "Paljonko käytin takseihin?" saa vastauksen oikeasta datasta, ja valmentaja opettaa samalla, että kiinteät kulut eivät ole kiinteitä.

**Vertaisarvioinnin koukku (mietitään lauantaina):** kävijä voi esimerkiksi valita datasta itsensä näköisen asiakkaan ja nähdä tämän säästöt.

## Rajaukset (mitä EI tehdä)
- Vakuutuksia ei kilpailuteta, koska se vaatii vakuutusedustajan rekisteröinnin. Ne näkyvät vain kulukorissa.
- Oikeaa vaihtoa ei tehdä. Vaihto on simuloitu, ja pitchissä kerrotaan miten se toimisi (uusi myyjä irtisanoo vanhan sopimuksen).
- Natiivisovellusta ei tehdä, vaan mobiiliselaimessa toimiva web-sovellus.
- Laskuja ei kuvata eikä ladata. Kaikki tulee e-laskuina ja pankkidatana. S-Pankilla ei ole tässä haasteessa avointa API:a, joten demossa käytetään synteettisiä Finvoice-e-laskuja, jotka kytketään datasetin Utilities-maksuihin. Tuotannossa ne tulisivat pankin oikeasta e-laskuvirrasta.
- Ensin hoidetaan sähkö. Puhelin ja netti tulevat vain, jos aikaa jää.

## Työkalut
| Tarve | Työkalu | Bonus |
|---|---|---|
| E-laskujen luku ja valmentajan aivot | **Gemini API** | Best Use of Gemini (1. palkinto €4k) |
| Sovellus ja julkinen linkki | React-webapp ja **Vercel** | – |
| Pankkidata | **S-Pankin Junction-data**, 1–3 demo-asiakasta esikäsiteltynä | – |
| E-laskut | Synteettiset **Finvoice**-e-laskut demo-asiakkaalle | – |
| Pörssisähkön hinta | Ilmainen rajapinta (porssisahko.net tai ENTSO-E) | – |
| Myyjien hinnat | Aluksi käsin ylläpidetty taulukko, myöhemmin **Context.dev** | Best Use of Context.dev |
| Ääni (jos aikaa) | **ElevenLabs** | MLH ElevenLabs |

## Aikataulu
| Milloin | Mitä | Kuka |
|---|---|---|
| Pe 21:00 | Tämä suunnitelma hyväksytty | Pietu ja Topias |
| Pe 23:59 | **Draft-lähetys** S-Pankki-haasteella | Pietu (Claude kirjoittaa tekstit) |
| Pe ilta | Sovelluksen runko ja S-Pankin data yhdelle asiakkaalle | Claude |
| La aamupäivä | Ydinflow: e-lasku, tunnistus, vertailu, vaihto | Claude, testaus koko tiimi |
| La iltapäivä | Valmentaja-chat, turvallinen käyttöraha, yksi wow-tekijä | Claude |
| La päivä | 10–15 haastattelua tai laskua muilta tiimeiltä ("säästäisitkö?") | Topias |
| La 14:30 | Kiuas "Can It Be a Company?" -sessio | Topias tai molemmat |
| La ilta | Pitch-deck, 2 min video, demon harjoittelu | Pietu ja Claude |
| Su 10:00 | **FINAL-lähetys** (deck PDF, video, demo- ja koodilinkit) | Pietu |
| Su 10:30–13:00 | Vertaisarviointi, koko tiimi paikalla | Molemmat |

## Työnjako
- **Pietu:** tuote ja pitch, eli tarina, deck ja demon esittäminen.
- **Topias:** validointi ja käyttäjät, eli haastattelut, oikeat säästöluvut pitchiin ja Junction-lomakkeet.
- **Claude:** koodi, datan käsittely ja tekstiluonnokset.

## Riskit ja vastaukset
- **Gemini lukee e-laskun väärin.** Käyttäjä näkee ja voi korjata poimitut tiedot, ja demon e-laskut on testattu etukäteen.
- **"Tämä on vain vertailusivusto."** Ero on jatkuvassa seurannassa ja vaihdossa hyväksynnällä, ja tuote on pankin sovelluksen sisällä.
- **"Miksi pankki tekisi tämän?"** Asiakas pysyy, luottamus kasvaa ja säästöt näkyvät S-Pankin sovelluksessa. Ruotsissa Swedbank tekee jo vastaavaa.
- **Säännöt:** kaikki koodi tehdään tapahtumassa, MIT-lisenssi, synteettinen tai haasteen data, ei olemassa olevaa yritystä.

## Avoimet kysymykset tiimille
1. ~~Tuotteen nimi?~~ Päätetty: **Solvo**.
2. Kuka on demon persoona? Ehdotus: S-Pankin datasta noin 35-vuotias espoolainen, jolla on korkeat laskut ja paljon ravintolakuluja.
3. Kumpi wow-tekijä lauantaina: ääni (ElevenLabs) vai oikeat myyjähinnat (Context.dev)?
