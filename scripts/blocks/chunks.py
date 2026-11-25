"""v1.22 — Blocs de phrases : des morceaux tout faits (« je ne sais pas », « c'est bien ce que je pensais »…)
avec une explication courte de la structure (particules, formes). Sources : les sous-titres de vidéos de Shun
et Ken-san envoyés par Arnold, et les phrases de l'app. Écrit src/data/chunks.json (les numéros ne changent jamais :
on ajoute seulement à la fin).
"""
import json, os

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')

# (japonais, kana découpés, français, explication)
C = [
    # ── Réagir dans une conversation (vidéos)
    ('そうですね', 'そう です ね', 'C\'est vrai. / Voyons…', 'ね cherche l\'accord de l\'autre. Dit en traînant, ça sert aussi à gagner du temps pour réfléchir.'),
    ('へえ', 'へえ', 'Ah bon ? Tiens !', 'Petite surprise, intérêt. Plus le son monte, plus on est étonné.'),
    ('なるほど', 'なるほど', 'Je vois. / D\'accord.', 'On vient de comprendre une explication.'),
    ('やっぱりそうか', 'やっぱり そう か', 'C\'est bien ce que je pensais.', 'やっぱり = comme prévu. そうか (sans です) = « ah, je vois », familier, presque à soi-même.'),
    ('そうかもしれない', 'そう かも しれない', 'C\'est possible. / Peut-être bien.', 'かもしれない = peut-être (pas sûr). Poli : かもしれません.'),
    ('よく知ってますね', 'よく しって ます ね', 'Tu connais bien !', 'よく devant un verbe = bien. 知ってます = forme parlée de 知っています (le い tombe à l\'oral).'),
    ('いえいえ', 'いえいえ', 'Mais non, pas du tout.', 'Réponse modeste à un merci ou un compliment.'),
    ('それはラッキーですね', 'それ は ラッキー です ね', 'C\'est une chance !', 'それは = ça (ce que tu viens de dire). ね : je constate avec toi.'),
    ('いいですね', 'いい です ね', 'C\'est bien ! / Bonne idée !', 'ね = on est d\'accord. Pour accepter une proposition : いいですね！'),
    ('本当ですか', 'ほんとう です か', 'C\'est vrai ?', 'À l\'oral entre amis : ほんと？'),
    ('そうなんですか', 'そう なん です か', 'Ah, c\'est comme ça ?', 'なんです (= のです) : on demande une explication, on montre de l\'intérêt pour ce que l\'autre raconte.'),
    ('めっちゃいい', 'めっちゃ いい', 'Super bien !', 'めっちゃ = très, trop (familier, à l\'origine du Kansai). Poli : とても.'),
    # ── Parler du bébé (vidéo)
    ('よく泣きますか', 'よく なきます か', 'Il pleure souvent ?', 'よく devant un verbe d\'action = souvent. (よく知ってます : là, よく = bien.)'),
    ('今寝てるかな', 'いま ねてる かな', 'Il dort peut-être en ce moment.', 'かな = « je me demande si… », on se parle à soi-même. 寝てる = 寝ている à l\'oral.'),
    ('妻が見てくれています', 'つま が みて くれて います', 'Ma femme s\'en occupe (pour moi).', '〜てくれる = quelqu\'un fait quelque chose pour moi. 見る ici = surveiller, s\'occuper de.'),
    ('寝てるから大丈夫です', 'ねてる から だいじょうぶ です', 'Il dort, donc ça va.', 'から après une phrase = parce que. La raison vient AVANT, le résultat après.'),
    ('大丈夫ですけど', 'だいじょうぶ です けど', 'Ça va, mais…', 'けど en fin de phrase laisse la phrase en suspens : ça adoucit, l\'autre comprend la suite.'),
    ('忙しい時に', 'いそがしい とき に', 'Alors que tu es occupé…', '時に = au moment où. Pour remercier : 忙しい時にありがとう.'),
    ('急に起きる', 'きゅう に おきる', 'Se réveiller d\'un coup.', '急に = soudain, sans prévenir.'),
    ('起きたら', 'おきたら', 'Quand il se réveille… / S\'il se réveille…', '〜たら = une fois que, si. Forme : passé en た + ら.'),
    ('よく泣くので', 'よく なく ので', 'Comme il pleure souvent…', 'ので = parce que, plus doux et poli que から. Bien pour s\'excuser ou expliquer.'),
    ('聞こえるかもしれません', 'きこえる かも しれません', 'Vous l\'entendrez peut-être.', '聞こえる = être audible (ça arrive tout seul), différent de 聞く = écouter.'),
    ('このコラボの間に', 'この コラボ の あいだ に', 'Pendant cette collaboration.', '〜の間に = pendant (à un moment de) ~.'),
    # ── Se revoir, inviter (vidéo)
    ('時間ができたら', 'じかん が できたら', 'Quand tu auras le temps.', 'できる = se libérer, apparaître (ici le temps). 〜たら = quand / si.'),
    ('遊びに来てください', 'あそび に きて ください', 'Viens nous voir !', '[verbe sans ます] + に来る = venir pour faire. 遊びに来る = venir en visite, passer.'),
    ('行きたい', 'いきたい', 'J\'ai envie d\'y aller.', '〜たい = vouloir faire. Poli : 行きたいです.'),
    ('見てみたいです', 'みて みたい です', 'J\'aimerais bien voir.', '〜てみる = essayer de faire. 〜てみたい = j\'aimerais essayer.'),
    ('今台北でしたっけ', 'いま たいぺい でした っけ', 'Tu es à Taipei en ce moment, c\'est ça ?', 'っけ = « c\'était bien ça ? » : on vérifie un souvenir. Le passé でした ne veut pas dire passé ici.'),
    ('行ったら会えますね', 'いったら あえます ね', 'Si j\'y vais, on pourra se voir.', '会える = forme « pouvoir » de 会う. 〜たら = si.'),
    ('一番近い空港', 'いちばん ちかい くうこう', 'L\'aéroport le plus proche.', '一番 + adjectif = le plus ~.'),
    ('次の動画で会いましょう', 'つぎ の どうが で あいましょう', 'On se retrouve dans la prochaine vidéo.', '〜ましょう = faisons ~. で = dans (le cadre où ça se passe).'),
    ('じゃあまたね', 'じゃあ また ね', 'Allez, à plus !', 'じゃあ = bon, alors. また = de nouveau. Familier.'),
    ('ありがとうございました', 'ありがとう ございました', 'Merci (pour ce qui vient de se passer).', 'Au passé : on remercie pour quelque chose de terminé (un repas, une aide, une vidéo).'),
    # ── En voyage (vidéo de Shun)
    ('白川郷にいます', 'しらかわごう に います', 'Je suis à Shirakawa-go.', 'に + います = être quelque part (personnes, animaux). Pour les choses : あります.'),
    ('一番好きな町の一つです', 'いちばん すき な まち の ひとつ です', 'C\'est une de mes villes préférées.', '〜の一つ = un des ~. 好きな町 : な relie 好き à un nom.'),
    ('見てください', 'みて ください', 'Regardez !', '〜てください = faites ~ (demande polie).'),
    ('天気がいいです', 'てんき が いい です', 'Il fait beau.', 'Mot à mot : le temps est bon. が montre de quoi on parle dans la description.'),
    ('雲があまりありません', 'くも が あまり ありません', 'Il n\'y a pas beaucoup de nuages.', 'あまり + négatif = pas beaucoup, pas très.'),
    ('岐阜県にあります', 'ぎふけん に あります', 'C\'est dans la préfecture de Gifu.', 'に + あります = se trouver quelque part (lieux, choses).'),
    ('高山市の近くに', 'たかやまし の ちかく に', 'Près de la ville de Takayama.', '〜の近くに = près de ~.'),
    # ── Ne pas comprendre, demander
    ('分かりません', 'わかりません', 'Je ne comprends pas.', '分かる = comprendre (ça « devient clair » pour moi) : on dit 〜が分かる, pas を.'),
    ('知りません', 'しりません', 'Je ne sais pas (je n\'ai pas l\'info).', 'Différent de 分かりません. 知りません peut sembler sec : 分からないです est plus doux.'),
    ('よく分かりません', 'よく わかりません', 'Je ne comprends pas bien.', 'よく = bien. Plus poli qu\'un simple 分かりません.'),
    ('ちょっと分からないです', 'ちょっと わからない です', 'Je ne sais pas trop.', 'ちょっと adoucit. Très naturel pour dire « je ne sais pas » poliment.'),
    ('もう一回', 'もう いっかい', 'Encore une fois.', 'もう + quantité = encore ~ (もう一つ = encore un).'),
    ('どういう意味ですか', 'どういう いみ です か', 'Ça veut dire quoi ?', 'どういう = quel genre de.'),
    ('日本語で何と言いますか', 'にほんご で なん と いいます か', 'Comment on dit ça en japonais ?', 'で = au moyen de (la langue). と = cite ce qu\'on dit.'),
    ('書いてもらえますか', 'かいて もらえます か', 'Vous pourriez me l\'écrire ?', '〜てもらえますか = demande polie (mot à mot : puis-je recevoir le fait que vous ~).'),
    ('ゆっくり話してください', 'ゆっくり はなして ください', 'Parlez lentement, s\'il vous plaît.', 'ゆっくり = lentement, tranquillement.'),
    ('トイレはどこですか', 'トイレ は どこ です か', 'Où sont les toilettes ?', '〜はどこですか = où est ~ ? は annonce ce dont on parle.'),
    ('英語のメニューはありますか', 'えいご の メニュー は あります か', 'Vous avez un menu en anglais ?', '〜はありますか = vous avez ~ ? / il y a ~ ? (あります pour les choses).'),
    ('座ってもいいですか', 'すわって も いい です か', 'Je peux m\'asseoir ?', '〜てもいいですか = je peux ~ ? Mot à mot : « même si je fais ~, c\'est bon ? ».'),
    ('どうすればいいですか', 'どう すれば いい です か', 'Qu\'est-ce que je dois faire ?', '〜ばいい = il suffit de ~. どうすれば = en faisant comment.'),
    ('どうやって行けばいいですか', 'どう やって いけば いい です か', 'Comment je fais pour y aller ?', 'どうやって = de quelle façon.'),
    # ── Commander, acheter
    ('お水をお願いします', 'おみず を おねがい します', 'De l\'eau, s\'il vous plaît.', '〜をお願いします marche partout. を marque la chose demandée.'),
    ('これをください', 'これ を ください', 'Donnez-moi ça, s\'il vous plaît.', '〜をください pour un objet ; 〜てください pour une action.'),
    ('これにします', 'これ に します', 'Je prends celui-ci.', '〜にする = choisir, se décider pour ~.'),
    ('じゃあ、それにします', 'じゃあ それ に します', 'Bon, je prends ça.', 'じゃあ = alors, bon (on vient de se décider).'),
    ('まだ決まっていません', 'まだ きまって いません', 'Je n\'ai pas encore choisi.', 'まだ + 〜ていません = pas encore. (Pas 決まりませんでした !)'),
    ('氷なしでお願いします', 'こおり なし で おねがい します', 'Sans glaçons, s\'il vous plaît.', 'なし = sans. 〜なしで = sans ~.'),
    ('カードで払えますか', 'カード で はらえます か', 'Je peux payer par carte ?', 'で = le moyen. 払える = pouvoir payer.'),
    ('全部でいくらですか', 'ぜんぶ で いくら です か', 'Ça fait combien en tout ?', '全部で = en tout (で = au total).'),
    ('ちょっと高いですね', 'ちょっと たかい です ね', 'C\'est un peu cher…', 'ちょっと adoucit une critique.'),
    ('見ているだけです', 'みて いる だけ です', 'Je regarde seulement.', 'だけ = seulement. 〜ている = être en train de.'),
    ('袋は大丈夫です', 'ふくろ は だいじょうぶ です', 'Pas besoin de sac.', '大丈夫です = « ça va » mais aussi « non merci » pour refuser poliment.'),
    ('結構です', 'けっこう です', 'Non merci, ça ira.', 'Refus poli (mais un peu ferme). Avec un sourire : いいえ、結構です.'),
    ('やっぱりやめておきます', 'やっぱり やめて おきます', 'Finalement, je vais m\'abstenir.', 'やっぱり = finalement (on change d\'avis). 〜ておく = faire (à l\'avance / par prudence).'),
    ('一つだけください', 'ひとつ だけ ください', 'Juste un, s\'il vous plaît.', 'だけ = seulement.'),
    ('もう少し待ってください', 'もう すこし まって ください', 'Attendez encore un peu.', 'もう少し = un peu plus. もう少し安いの = un peu moins cher.'),
    # ── Se déplacer
    ('新宿まで行きたいです', 'しんじゅく まで いきたい です', 'Je voudrais aller à Shinjuku.', 'まで = jusqu\'à.'),
    ('このホテルまでお願いします', 'この ホテル まで おねがい します', 'À cet hôtel, s\'il vous plaît.', 'Dans un taxi : la destination + までお願いします.'),
    ('次の駅で降ります', 'つぎ の えき で おります', 'Je descends à la prochaine gare.', 'で = l\'endroit où l\'action se passe. 降りる = descendre (d\'un véhicule).'),
    ('歩いて行けますか', 'あるいて いけます か', 'On peut y aller à pied ?', '歩いて = en marchant. 行ける = pouvoir aller.'),
    ('右に曲がってください', 'みぎ に まがって ください', 'Tournez à droite.', 'に = la direction.'),
    ('まっすぐ行ってください', 'まっすぐ いって ください', 'Allez tout droit.', 'まっすぐ = tout droit.'),
    ('電車が遅れています', 'でんしゃ が おくれて います', 'Le train a du retard.', '〜ている = état actuel (il est en retard maintenant).'),
    ('もうすぐ着きます', 'もうすぐ つきます', 'J\'arrive bientôt.', 'もうすぐ = très bientôt.'),
    ('着いたら連絡して', 'ついたら れんらく して', 'Préviens-moi quand tu arrives.', '〜たら = quand (une fois que).'),
    # ── Les particules en contexte
    ('私は', 'わたし は', 'Moi, (je)…', 'は annonce le thème : « quant à moi ». Souvent on ne le dit même pas.'),
    ('私が', 'わたし が', 'C\'est moi qui…', 'が met l\'accent sur QUI : 私が行きます = c\'est moi qui y vais.'),
    ('猫が好きです', 'ねこ が すき です', 'J\'aime les chats.', 'Avec 好き, 嫌い, 上手, 分かる, 欲しい : l\'objet prend が, pas を.'),
    ('家で食べます', 'いえ で たべます', 'Je mange à la maison.', 'で = l\'endroit où on FAIT une action.'),
    ('家にいます', 'いえ に います', 'Je suis à la maison.', 'に = l\'endroit où on EST (いる, ある, 住む).'),
    ('日本に行きます', 'にほん に いきます', 'Je vais au Japon.', 'に = destination. へ (prononcé え) marche aussi : 日本へ.'),
    ('友達と', 'ともだち と', 'Avec un ami.', 'と = avec (quelqu\'un), ou « et » entre deux noms.'),
    ('私も', 'わたし も', 'Moi aussi.', 'も = aussi. Il remplace は ou が : 私も行きます.'),
    ('駅から家まで', 'えき から いえ まで', 'De la gare jusqu\'à la maison.', 'から = depuis, à partir de. まで = jusqu\'à.'),
    ('七時までに', 'しちじ までに', 'Avant 7 h (au plus tard).', 'までに = date limite. まで tout seul = pendant tout le temps jusqu\'à.'),
    ('七時まで', 'しちじ まで', 'Jusqu\'à 7 h.', 'まで = jusqu\'à (l\'action continue jusque-là). Comparer avec までに.'),
    ('日本の', 'にほん の', 'Du Japon, japonais.', 'の relie deux noms : 日本の料理 = la cuisine du Japon.'),
    ('食べるのが好きです', 'たべる の が すき です', 'J\'aime manger.', 'の transforme le verbe en nom : « le fait de manger ».'),
    ('電車で', 'でんしゃ で', 'En train.', 'で = au moyen de (transport, outil, langue).'),
    ('三つで', 'みっつ で', 'Les trois ensemble, en tout.', 'で après une quantité = au total.'),
    ('千円しかない', 'せんえん しか ない', 'Je n\'ai que 1000 yens.', 'しか + négatif = seulement (et c\'est peu). だけ = seulement, sans ce regret.'),
    # ── Relier les phrases : parce que, mais, alors que
    ('雨だから', 'あめ だ から', 'Comme il pleut…', 'から après une phrase = parce que. La raison avant, la suite après. Direct, oral.'),
    ('用事があるので', 'ようじ が ある ので', 'Comme j\'ai un truc à faire…', 'ので = parce que, plus doux et poli que から : parfait pour s\'excuser ou refuser.'),
    ('ですから', 'です から', 'C\'est pourquoi… / Donc…', 'En début de phrase : « c\'est pour ça que ». Version polie de だから.'),
    ('だから', 'だから', 'Donc. / C\'est pour ça.', 'En début de phrase, familier. Peut sonner un peu sec : « je te l\'avais dit ! ».'),
    ('ちょっと聞きたいんですけど', 'ちょっと ききたい ん です けど', 'J\'aurais une petite question…', 'んです = j\'explique la situation ; けど laisse la phrase ouverte, l\'autre comprend qu\'une demande arrive.'),
    ('頭が痛いんです', 'あたま が いたい ん です', 'C\'est que j\'ai mal à la tête.', 'んです donne une explication, un contexte (pourquoi je dis ça).'),
    ('高いけど、おいしい', 'たかい けど おいしい', 'C\'est cher, mais c\'est bon.', 'けど relie deux idées opposées. Plus poli ou écrit : が.'),
    ('三人ですが、席はありますか', 'さんにん です が せき は あります か', 'On est trois, vous avez de la place ?', 'Entre deux phrases, が = mais / et : il introduit la vraie question en douceur.'),
    ('でも', 'でも', 'Mais… / Pourtant…', 'En début de phrase. Après un nom : コーヒーでも = un café, ou autre chose.'),
    ('約束したのに', 'やくそく した のに', 'Alors qu\'il avait promis…', 'のに = alors que, et pourtant (surprise, regret).'),
    ('安いし、おいしいし', 'やすい し おいしい し', 'C\'est pas cher, et en plus c\'est bon.', 'し empile les raisons, l\'une après l\'autre.'),
    ('それに', 'それに', 'En plus…', 'Ajoute une raison de plus.'),
    ('それで', 'それで', 'Et alors… / Du coup…', 'Ce qui suit est la conséquence. それで？ = et alors ?'),
    ('じゃあ', 'じゃあ', 'Bon, alors…', 'On passe à la suite ou on conclut. Poli : では.'),
    # ── Temps et ordre des actions
    ('食べてから行く', 'たべて から いく', 'Je mange, puis j\'y vais.', '〜てから = après avoir ~. (Comparer : 雨だから = parce que.)'),
    ('寝る前に', 'ねる まえ に', 'Avant de dormir.', 'Verbe au présent + 前に = avant de ~.'),
    ('食べた後で', 'たべた あと で', 'Après avoir mangé.', 'Verbe au passé + 後で = après ~.'),
    ('テレビを見ながら', 'テレビ を み ながら', 'En regardant la télé.', 'Verbe sans ます + ながら = deux actions en même temps.'),
    ('若い時', 'わかい とき', 'Quand j\'étais jeune.', '〜時 = quand, à l\'époque où.'),
    ('買い物したり、映画を見たり', 'かいもの したり えいが を みたり', 'Faire du shopping, voir un film…', '〜たり〜たりする = des choses comme ~ et ~ (liste d\'exemples).'),
    ('まだ食べていない', 'まだ たべて いない', 'Je n\'ai pas encore mangé.', 'まだ + 〜ていない = pas encore (ça peut encore arriver).'),
    ('もう食べた', 'もう たべた', 'J\'ai déjà mangé.', 'もう + passé = déjà.'),
    ('結婚しています', 'けっこん して います', 'Je suis marié.', '〜ている a 2 sens : action en cours (食べている) ou état qui dure (ici : être marié).'),
    ('忘れちゃった', 'わすれちゃった', 'J\'ai oublié (oups).', '〜ちゃった = 〜てしまった à l\'oral : action finie, souvent avec regret.'),
    ('予約しておきます', 'よやく して おきます', 'Je vais réserver à l\'avance.', '〜ておく = faire à l\'avance, pour plus tard.'),
    # ── Envies, projets, avis
    ('日本に行きたいです', 'にほん に いきたい です', 'Je voudrais aller au Japon.', 'Verbe sans ます + たい = vouloir faire.'),
    ('行くつもりです', 'いく つもり です', 'J\'ai l\'intention d\'y aller.', '〜つもり = projet décidé dans ma tête.'),
    ('二週間いる予定です', 'にしゅうかん いる よてい です', 'Je compte rester deux semaines.', '〜予定 = c\'est au programme (plus concret que つもり).'),
    ('いいと思います', 'いい と おもいます', 'Je pense que c\'est bien.', 'と cite la pensée. と思います adoucit une affirmation.'),
    ('明日は晴れるでしょう', 'あした は はれる でしょう', 'Demain, il fera sans doute beau.', 'でしょう = sans doute (supposition). Familier : でしょ？ = hein ?'),
    ('おいしそう', 'おいしそう', 'Ça a l\'air bon !', 'Adjectif sans い + そう = ça a l\'air ~ (ce que je vois).'),
    ('雨が降るそうです', 'あめ が ふる そう です', 'Il paraît qu\'il va pleuvoir.', 'Phrase complète + そうです = il paraît que (ce que j\'ai entendu). Comparer : おいしそう = ça a l\'air.'),
    ('寝ているみたい', 'ねて いる みたい', 'On dirait qu\'il dort.', '〜みたい = on dirait que (impression). Poli : 〜ようです.'),
    ('行ったことがあります', 'いった こと が あります', 'J\'y suis déjà allé.', 'Passé + ことがある = avoir déjà fait (une expérience).'),
    ('早く寝たほうがいい', 'はやく ねた ほう が いい', 'Tu ferais mieux de dormir tôt.', 'Passé + ほうがいい = il vaut mieux (conseil).'),
    ('行かなければなりません', 'いかなければ なりません', 'Je dois y aller.', 'Obligation (poli, un peu écrit). Oral : 行かなきゃ.'),
    ('早く起きないといけない', 'はやく おきない と いけない', 'Je dois me lever tôt.', '〜ないといけない = il faut (version de tous les jours).'),
    ('払わなくてもいい', 'はらわなくて も いい', 'Pas besoin de payer.', '〜なくてもいい = pas obligé de ~.'),
    ('食べすぎた', 'たべすぎた', 'J\'ai trop mangé.', '〜すぎる = trop. 高すぎる = trop cher.'),
    ('読みやすい', 'よみやすい', 'Facile à lire.', 'Verbe sans ます + やすい = facile à ~. Contraire : 〜にくい.'),
    ('行くかどうか分からない', 'いく か どう か わからない', 'Je ne sais pas si j\'y vais.', '〜かどうか = si ~ ou non.'),
    ('どこか分かりません', 'どこ か わかりません', 'Je ne sais pas où c\'est.', 'Une question glissée dans la phrase : どこ + か + 分かりません.'),
    # ── Formules utiles
    ('すみません', 'すみません', 'Excusez-moi. / Merci (pour le dérangement).', 'Pour appeler quelqu\'un, s\'excuser, ou remercier quand on a dérangé.'),
    ('ちょっと…', 'ちょっと', 'C\'est-à-dire… (non poli)', 'Dit en suspens, c\'est un refus doux : その日はちょっと… = ce jour-là, ça m\'arrange pas.'),
    ('お疲れ様です', 'おつかれさま です', 'Bon travail. / Salut (collègues).', 'Entre collègues, en arrivant, en partant, après un effort.'),
    ('お世話になりました', 'おせわ に なりました', 'Merci pour tout.', 'Quand on part (hôtel, séjour, travail) : merci de vous être occupé de moi.'),
    ('楽しみにしています', 'たのしみ に して います', 'J\'ai hâte !', '〜を楽しみにする = attendre avec impatience.'),
    ('気をつけて', 'き を つけて', 'Fais attention à toi.', 'Pour dire au revoir à quelqu\'un qui part.'),
    ('お大事に', 'おだいじに', 'Soigne-toi bien.', 'À quelqu\'un de malade.'),
    ('よろしくお願いします', 'よろしく おねがい します', 'Je compte sur vous. / Enchanté.', 'Après une présentation ou une demande : on s\'en remet à l\'autre.'),
    ('まだまだです', 'まだまだ です', 'J\'ai encore beaucoup à apprendre.', 'Réponse modeste à un compliment (上手ですね！).'),
    ('高いじゃないですか', 'たかい じゃない です か', 'C\'est cher, non ?', 'Pas une négation : じゃないですか rappelle quelque chose d\'évident.'),
    ('おいしいよ', 'おいしい よ', 'C\'est bon, je te dis !', 'よ = je t\'apprends quelque chose. ね = on partage la même info.'),
    ('おいしいね', 'おいしい ね', 'C\'est bon, hein ?', 'ね = je cherche ton accord, on le constate ensemble.'),
    ('明日休みだよね', 'あした やすみ だ よ ね', 'Demain c\'est congé, c\'est bien ça ?', 'よね = je suis presque sûr, je vérifie avec toi.'),
]


def main():
    out = []
    for i, (jp, kana, fr, note) in enumerate(C, start=1):
        out.append({'id': i, 'jp': jp, 'kana': kana, 'fr': fr, 'note': note})
    p = os.path.join(ROOT, 'src', 'data', 'chunks.json')
    json.dump(out, open(p, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(len(out), 'blocs')


if __name__ == '__main__':
    main()
