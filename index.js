const { Client, GatewayIntentBits } = require('discord.js');

// Remplace par ton token Discord et l'ID du canal
const DISCORD_TOKEN = 'TOKEN_DISCORD';

const pos = [
  ':one:',
  ':two:',
  ':three:',
  ':four:',
  ':five:',
  ':six:',
  ':seven:',
  ':eight:',
  ':nine:',
  ':keycap_ten:',
  ':one::one:',
  ':one::two:',
  ':one::three:',
  ':one::four:',
  ':one::five:',
  ':one::six:',
  ':one::seven:',
  ':one::eight:',
  ':one::nine:',
  ':two::zero:',
  ':two::one:',
  ':two::two:',
  ':two::three:',
  ':two::four:',
  ':two::five:',
  ':two::six:',
  ':two::seven:',
  ':two::eight:',
  ':two::nine:',
  ':three::zero:',
];

let gameState = {}; // Pour garder l'état du jeu, y compris les inscriptions

// Crée un client Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

function createMasterMessage(formattedDate, avaibleSlots = 11) {
    return `
:full_moon: **Appel à la meute !** :full_moon: [ @Ping soirée ]
Ce soir, préparez-vous à une game Lycans :wolf::sparkles! 

:video_game: **Au programme** : une partie 100% non moddé.
:clock3: **Quand** : ${formattedDate}.
:Lycans: Si tu es débutant, tu es le bienvenu :wink:

:zap: **Attention, les places sont limitées !**
:point_right: **${avaibleSlots}** joueurs peuvent encore rejoindre l’aventure. Ne tardez pas à réserver la vôtre pour ne pas rester dans l’ombre :crescent_moon:.

Que vous soyez un loup affamé ou un villageois rusé, venez montrer vos talents de déduction, vos stratégies malignes et partager un bon moment avec toute la meute. :speech_balloon::fire:

Rendez-vous ce soir pour une pleine lune mémorable ! :feet:

:bell: Merci de répondre directement dans le fil de discussion pour éviter de polluer le canal principal !
`
}

function createThreadMessage(gameState) {
let threadMessageContent = `
Code : \`${gameState.code}\`
Serveur : ${gameState.server}
Rendez-vous : ${gameState.formattedDate}

------------------

**Inscriptions :**

`;

for (let i = 0; i < gameState.slots; i++) {
    // Vérifier si un joueur est inscrit à cette position
    var player = gameState.players[i] ? `<@${gameState.players[i]}>` : ''; // Si le joueur est inscrit, on ajoute sa mention

    if (i > 0) {
        var player = gameState.players[i];
    }

    // Ajouter la ligne au message
    threadMessageContent += `- :${pos[i]}: ${player}\n`;
}
threadMessageContent += `
------------------

**En Attente :**
${Array.from({ length: gameState.waitingList }, (_, i) => `- ${i} > ${i === 0 ? `<@${gameState.waitingList[i]}>` : ''}`).join('\n')}
`;

return threadMessageContent;
}

// Déclenchement lorsque le bot est prêt
client.once('ready', () => {
  console.log(`Bot connecté comme ${client.user.tag}`);
});

// Commande de création de partie
client.on('messageCreate', async (message) => {
  if (!message.content.startsWith('!create_game') || message.author.bot) return;
  
  // Extraire les arguments
  const args = message.content.slice('!create_game'.length).trim().split(/\s+/);

  try {
    // Récupérer les paramètres obligatoires et optionnels
    const date = args[0];
    const time = args[1];
    const code = args[2] || 'Non spécifié';
    const server = args[3] || 'Europe Ouest';
    const slots = parseInt(args[5], 10) || 12;

    // Vérifier le format de la date
    const [day, month, year] = date.split('/');
    const [hours, minutes] = time.split(':');
    const gameDate = new Date(`${year}-${month}-${day}T${hours}:${minutes}`);
    if (isNaN(gameDate)) {
      message.reply('Format de date/heure invalide. Utilise `dd/mm/yyyy hh:mm [code] [serveur] [mods] [slots]`');
      return;
    }

    const formattedDate = gameDate.toLocaleString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Accéder au canal
    const channel = await message.channel;
    if (!channel || !channel.isTextBased()) {
      message.reply("Le canal spécifié est introuvable ou n'est pas un canal texte.");
      return;
    }

    // Message principal
    const mainMessageContent = createMasterMessage(formattedDate, slots);

    // Envoyer le message principal
    const mainMessage = await channel.send(mainMessageContent);

    // Créer un fil de discussion
    const thread = await mainMessage.startThread({
      name: `Discussion - ${formattedDate}`,
      autoArchiveDuration: 1440, // Archive après 24h
    });

    // Initialiser l'état du jeu pour ce thread
    gameState[thread.id] = {
      code: code,
      slots: 12,
      server: server,
      formattedDate: formattedDate,
      players: [message.author.id], // Le créateur de la partie est inscrit
      waitingList: [],
      mainMessage: mainMessage, // Stocker le message principal
      threadMessage: null, // Stocker le message dans le thread
    };

    // Message dans le fil
    const threadMessageContent = createThreadMessage(gameState[thread.id]);

    const threadMessage = await thread.send(threadMessageContent);
    gameState[thread.id].threadMessage = threadMessage;

  } catch (error) {
    console.error(error);
    message.reply("Une erreur s'est produite lors de la création de la partie.");
  }
});

// Commandes dans les fils de discussion
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Si le message est dans un fil de discussion et commence par une commande
  if (message.channel.isThread() && gameState[message.channel.id]) {
    const args = message.content.split(/\s+/);
    const command = args[0].toLowerCase();
    const pseudo = args[1];

    if (command === '!claim' && pseudo) {
      // Inscrire un joueur dans la liste des joueurs
      const game = gameState[message.channel.id];
      if (game.players.length < game.slots) {
        game.players.push(pseudo);
        message.reply(`Le joueur ${pseudo} a été ajouté à la liste des joueurs.`);

        // Mise à jour du message principal pour afficher les joueurs
        await game.mainMessage.edit(createMasterMessage(game.formattedDate, 12 - game.players));
        await game.threadMessage.edit(createThreadMessage(game));
      } else {
        game.waitingList.push(pseudo);
        message.reply(`Il n'y a plus de place, ${pseudo} a été ajouté à la liste d'attente.`);
      }
    }

    if (command === '!unclaim' && pseudo) {
      // Retirer un joueur de la liste
      const game = gameState[message.channel.id];
      const playerIndex = game.players.indexOf(pseudo);
      if (playerIndex !== -1) {
        game.players.splice(playerIndex, 1);
        message.reply(`Le joueur ${pseudo} a été retiré de la liste des joueurs.`);

        await game.mainMessage.edit(createMasterMessage(game.formattedDate, game.slots - game.players));
        await game.threadMessage.edit(createThreadMessage(game));

      } else {
        message.reply(`Le joueur ${pseudo} n'est pas inscrit.`);
      }
    }

    if (command === '!setSlots' && pseudo) {
      if (pseudo >= 12 && pseudo <= pos.length) {
        gameState[message.channel.id].slots = pseudo;
        await game.mainMessage.edit(createMasterMessage(game.formattedDate, game.slots - game.players));
        await game.threadMessage.edit(createThreadMessage(game));
      }
      else {
        message.reply(`Le nombre de slots ${pseudo} n'est pas compris entre 12 et ${pos.length}.`);
      }
    }
  }
});

// Connecte le bot
client.login(DISCORD_TOKEN);
