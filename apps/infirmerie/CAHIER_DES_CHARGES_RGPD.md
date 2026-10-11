# CAHIER DES CHARGES & REGISTRE DE CONFORMITÉ RGPD
## Traitement Informatisé des Fiches d'Infirmerie et Dossiers Médicaux Scolaires
### {{ETABLISSEMENT}}

---

**Référence document :** CDC-RGPD-INFIRMERIE-NDM-2026-V1  
**Date d'entrée en vigueur :** Rentrée Scolaire 2026  
**Dernière révision :** Septembre 2026  
**Établissement :** {{ETABLISSEMENT}}  
**Statut :** Établissement Catholique d'Enseignement sous contrat d'association avec l'État  
**Responsable de traitement :** Chef d'Établissement / Direction Générale  
**Service utilisateur :** Service Infirmerie Scolaire  
**Contact DPO / Référent RGPD :** `dpo@ndmissions.fr` / `service.informatique@gmail.com`  

---

## SOMMAIRE EXÉCUTIF

Le présent cahier des charges formalise la conformité stricte de l'application **« Fiche Infirmerie Numérique »** de l'établissement {{ETABLISSEMENT}} avec :
1. Le **Règlement Général sur la Protection des Données (RGPD - Règlement UE 2016/679)** ;
2. La **Loi n° 78-17 du 6 janvier 1978 modifiée (Loi Informatique et Libertés)** ;
3. Le **Code de la Santé Publique** (notamment articles L. 1110-4 sur le secret médical et L. 3111-2 sur les obligations vaccinales) ;
4. Le **Code de l'Éducation** (articles L. 541-1 et suivants relatifs à la santé scolaire) ;
5. Les référentiels de sécurité de la **CNIL** et de l'**ANSSI** applicables aux données de santé et aux mineurs.

---

## 1. FICHE D'IDENTITÉ DU TRAITEMENT (REGISTRE ART. 30 RGPD)

| Rubrique | Description officielle |
| :--- | :--- |
| **Nom du traitement** | Gestion dématérialisée des fiches de santé scolaires et suivi infirmerie |
| **Responsable du traitement** | {{ETABLISSEMENT}} |
| **Finalité principale** | Prise en charge sanitaire, gestion des urgences médicales et suivi de l'obligation vaccinale des élèves scolarisés |
| **Finalités secondaires** | - Gestion des protocoles d'accueil individualisé (PAI) pour allergies et maladies chroniques<br>- Déclaration d'urgence auprès des services de secours (SAMU 15, Pompiers 18)<br>- Archivage légal de l'autorisation parentale de soins et d'hospitalisation |
| **Catégories de personnes** | - Élèves mineurs scolarisés (Maternelle, Primaire, Collège, Lycée)<br>- Représentants légaux / Parents d'élèves<br>- Professionnels de santé référents (médecin traitant, spécialiste) |
| **Caractère des données** | Données sensibles au sens de l'**Article 9 du RGPD** (données de santé) |

---

## 2. BASES LÉGALES ET LICÉITÉ DU TRAITEMENT (ART. 6 & ART. 9 RGPD)

### 2.1. Base juridique générale (Article 6 du RGPD)
* **Article 6.1.c (Obligation légale) :** L'établissement scolaire est soumis à l'obligation légale de contrôle de la vaccination obligatoire (Art. L. 3111-2 du Code de la santé publique) et de mise en place de la surveillance de la santé des élèves (Art. L. 541-1 du Code de l'éducation).
* **Article 6.1.e (Mission d'intérêt public) :** Prévention, veille sanitaire et secours en milieu scolaire.
* **Article 6.1.d (Sauvegarde des intérêts vitaux) :** Prise en charge immédiate de l'enfant en cas d'accident grave, crise d'allergie ou détresse respiratoire.

### 2.2. Dérogations à l'interdiction de traitement des données de santé (Article 9 du RGPD)
* **Article 9.2.h :** Traitement nécessaire aux fins de la **médecine préventive**, des diagnostics médicaux, de la prise en charge sanitaire ou de la gestion des systèmes et des services de soins de santé.
* **Article 9.2.i :** Motifs d'intérêt public dans le domaine de la **santé publique** (contrôle épidémique et couverture vaccinale).

---

## 3. CATÉGORIES DE DONNÉES COLLECTÉES (MINIMISATION ART. 5.1.c)

Conformément au principe de **minimisation**, seules les informations strictement nécessaires à la sécurité physique et sanitaire de l'élève sont collectées :

### 3.1. Données d'état civil et de scolarité
* Nom de famille, prénom, sexe, date de naissance.
* Classe et division d'affectation (de la Toute Petite Section à la Terminale).
* Régime scolaire (externe, demi-pensionnaire, interne).

### 3.2. Coordonnées des représentants légaux et personnes à contacter
* Identité (Nom, Prénom, lien de parenté / tutelle).
* Téléphones mobiles, domiciles et professionnels.
* Adresse postale du domicile familial.
* Personnes autorisées à récupérer l'enfant ou à contacter en cas d'urgence si les parents sont injoignables.

### 3.3. Données de santé de l'élève (sensibles)
* **Prise en charge d'urgence :**
  - Nom, ville et téléphone du médecin traitant ou pédiatre.
  - Hôpital ou clinique de préférence en cas de transfert.
* **Situation médicale particulière :**
  - Existence d'un Projet d'Accueil Individualisé (**PAI**), Projet Personnalisé de Scolarisation (**PPS**) ou PAP.
  - Allergies alimentaires ou médicamenteuses sévères.
  - Asthme, diabète, épilepsie, troubles cardiaques ou hémophiles.
  - Traitement médical en cours pris sur le temps scolaire (avec ordonnance obligatoire).
  - Port de lunettes, lentilles de contact, appareils dentaires ou auditifs.
  - Recommandations ou précautions particulières d'éducation physique et sportive (EPS).
* **Vaccinations obligatoires :**
  - Calendrier vaccinal DT-Polio, ROR, Coqueluche, Hépatite B, etc.
  - **Dépôt certifié du carnet de santé / vaccinations** (copie numérisée obligatoire transmise par le responsable légal).

### 3.4. Autorisation parentale et signature numérique
* Acceptation formelle de l'intervention des services d'urgence et d'hospitalisation d'urgence.
* Signature manuscrite numérisée horodatée avec adresse IP source, date et heure certifiées.

---

## 4. DESTINATAIRES DES DONNÉES ET SECRET MÉDICAL (ART. 28 & 29)

### 4.1. Accès interne restreint (Habilitations nominatives)
* **Infirmière scolaire :** Accès complet en lecture, modification, validation et édition aux données médicales.
* **Médecin scolaire attaché à l'établissement :** Accès aux données de santé sous le sceau du secret professionnel.
* **Direction de l'établissement :** Accès aux fiches de contact d'urgence et aux fiches récapitulatives PAI (à l'exclusion des antécédents médicaux détaillés protégés par le secret médical).
* **Enseignants / Professeurs principaux :** Information sur les consignes d'urgence opérationnelles (trousses d'urgence PAI, conduites à tenir en cas de crise) transmises exclusivement par l'infirmière.

### 4.2. Destinataires externes d'urgence
* **Services de secours d'urgence (SAMU - Centre 15, Pompiers 18, SMUR) :** Transmission immédiate de la fiche d'urgence et de l'autorisation d'hospitalisation en cas de sinistre ou d'accident corporel.
* **Personnel soignant de l'hôpital d'accueil :** Remise du dossier par l'équipe ambulancière.

### 4.3. Absence formelle de tiers commerciaux
* **Aucune transmission de données à des tiers, régies publicitaires, partenaires ou éditeurs privés.**
* **Aucun cookie publicitaire ou de tracking (Google Analytics, Facebook Pixel, etc.) n'est installé.**

---

## 5. MESURES TECHNIQUES ET ORGANISATIONNELLES DE SÉCURITÉ (ART. 32 RGPD)

L'architecture logicielle de l'application met en œuvre les préconisations du guide de sécurité de la CNIL et de l'ANSSI :

### 5.1. Cryptographie & Chiffrement au Repos (AES-256-GCM)
* **Stockage 100% chiffré :** Tous les fichiers de données médicales (`fiches.enc`, `accounts.enc`, `draft.enc`) sont chiffrés sur le disque avec l'algorithme militaire **AES-256-GCM** (Galois/Counter Mode).
* **Intégrité et non-répudiation :** Chaque bloc de données comprend un vecteur d'initialisation aléatoire (IV) de 96 bits et une étiquette d'authentification (Auth Tag) de 128 bits empêchant toute falsification ou corruption indétectable.
* **Gestion des clés de chiffrement :** La clé maîtresse de 256 bits est générée aléatoirement via le générateur cryptographique matériel du système (`crypto.randomBytes`) et protégée avec des droits de lecture stricts (`chmod 600`) réservés à l'administrateur système.

### 5.2. Chiffrement des Identifiants & Questions Secrètes (PBKDF2)
* **Mots de passe parents et administrateurs :** Jamais stockés en clair. Hachage avec **PBKDF2-HMAC-SHA512**, avec un sel cryptographique aléatoire de 128 bits et **100 000 itérations**.
* **Questions de sécurité parentales :** La réponse secrète est normalisée (suppression des accents, minuscules, espaces) et hachée avec sel (PBKDF2-SHA256, 50 000 itérations), garantissant qu'aucun opérateur ou administrateur ne peut connaître la réponse secrète des familles.

### 5.3. Souveraineté & Hébergement 100% Local (On-Premise)
* **Infrastructure dédiée :** Serveur physique local hébergé dans les locaux de l'établissement (Container Debian 12 / Proxmox VE).
* **Zéro Cloud Tiers :** Les données de santé ne transitent par aucun serveur étranger ou service Cloud public (AWS, Microsoft Azure, Google Cloud). L'établissement conserve la maîtrise physique absolue de son serveur et de ses sauvegardes.

### 5.4. Politique « Zéro Stockage Navigateur » (Privacy by Design)
* Aucune donnée de santé ni carnet vaccinal n'est stocké dans le `localStorage` ou `sessionStorage` du navigateur Web du parent.
* Entêtes HTTP de sécurité stricts : `Cache-Control: no-store, no-cache, must-revalidate, private` interdisant la conservation de copies dans les mémoires caches des postes publics ou partagés.

### 5.5. Horodatage & Traçabilité des Signatures
* La signature électronique de l'autorisation parentale génère une empreinte numérique comportant l'adresse IP du signataire, l'horodatage précis à la seconde, l'identité certifiée et le condensat du document signé.

---

## 6. DURÉE DE CONSERVATION DES DONNÉES (ART. 5.1.e RGPD)

| Type de document | Durée en base active | Durée en archivage intermédiaire | Sort final |
| :--- | :--- | :--- | :--- |
| **Fiche Infirmerie de l'année** | 1 année scolaire (septembre à août) | Durée de scolarité de l'élève dans l'établissement | Purge électronique définitive |
| **Copie Carnet de Vaccinations** | 1 année scolaire | Conservée jusqu'au départ ou radiation de l'élève | Destruction sécurisée |
| **Autorisation de soins & hospitalisation** | 1 année scolaire | 1 an après la fin de scolarité (prescription responsabilité) | Destruction sécurisée |
| **Comptes d'accès parents** | Active tant qu'au moins 1 enfant est scolarisé | 1 an d'inactivité après le départ du dernier enfant | Suppression automatique |
| **Journaux techniques de connexion** | 6 mois glissants | 1 an légal | Rotation automatique des logs |

---

## 7. EXERCICE DES DROITS DES FAMILLES (ART. 15 À 22 DU RGPD)

Les représentants légaux et les élèves disposent des droits suivants, qu'ils peuvent exercer à tout moment auprès du Délégué à la Protection des Données :

1. **Droit d'accès (Art. 15) :** Les parents peuvent consulter l'intégralité des données saisies et télécharger une copie certifiée PDF de la fiche de leur enfant à tout instant depuis leur espace sécurisé.
2. **Droit de rectification (Art. 16) :** Mise à jour immédiate des coordonnées téléphoniques, changements de médecin traitant ou nouveaux traitements médicaux sur simple demande ou ré-édition en ligne.
3. **Droit à l'effacement (Art. 17) :** Possible dès la fin de la scolarité de l'élève, sous réserve des obligations légales de conservation des pièces engageant la responsabilité de l'établissement.
4. **Droit à la limitation du traitement (Art. 18) :** Possibilité de restreindre temporairement l'utilisation des données en cas de contestation sur leur exactitude.
5. **Droit de réclamation :** En cas de difficulté, les familles ont le droit d'introduire une réclamation auprès de l'autorité de contrôle nationale :  
   **Commission Nationale de l'Informatique et des Libertés (CNIL)**  
   3 Place de Fontenoy - TSA 80715 - 75334 PARIS CEDEX 07  
   Téléphone : 01 53 73 22 22 - Site Web : [www.cnil.fr](https://www.cnil.fr)

---

## 8. ANALYSE D'IMPACT RELATIVE À LA PROTECTION DES DONNÉES (AIPD / PIA)

En application de l'**Article 35 du RGPD** et des lignes directrices du Comité Européen de la Protection des Données (CEPD) :
* **Critères activés :** Données de santé (données sensibles, Art. 9) concernant des personnes vulnérables (mineurs d'âge scolaire).
* **Évaluation du risque résiduel :** FAIBLE à NÉGLIGEABLE grâce aux mesures de protection :
  - Absence de transmission externe / hébergement souverain on-premise.
  - Chiffrement symétrique fort AES-256-GCM.
  - Accès strictement cloisonné au personnel soignant assermenté.
  - Authentification obligatoire et absence de tout profilage automatique.
* **Conclusion AIPD :** Le traitement est dispensé d'homologation préalable de la CNIL au titre de la gestion courante de la santé scolaire sous contrôle du médecin et de l'infirmière scolaire (délibération CNIL n° 2018-303).

---

## 9. PROCÉDURE DE GESTION DES VIOLATIONS DE DONNÉES (ART. 33 & 34)

En cas d'incident de sécurité (tentative d'intrusion, altération ou indisponibilité) :
1. **Qualification de l'incident sous 2 heures** par le service informatique et le responsable légal.
2. **Notification à la CNIL dans un délai maximal de 72 heures** via le portail officiel de télédéclaration de la CNIL si la fuite présente un risque pour les droits des personnes.
3. **Notification individuelle sans délai** aux représentants légaux concernés si le risque est élevé, avec indication des mesures correctives immédiates.

---

## 10. ENGAGEMENT DE CONFORMITÉ & SIGNATURE

Fait à Charenton-le-Pont, le 17 septembre 2026.

**Pour l'établissement {{ETABLISSEMENT}} :**  
*La Direction de l'Établissement & Le Référent Protection des Données (DPO)*  
Document officiel annexé au Registre des Activités de Traitement de l'Établissement.
