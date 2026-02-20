// SIA Virtual Bot Code with Slash Command
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionsBitField,
  MessageFlags,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const botToken = process.env.DISCORD_TOKEN || process.env.TOKEN;
const MAX_EMBED_DESCRIPTION_LENGTH = 3800;

function isModeratorOrAbove(interaction) {
  if (!interaction.inGuild() || !interaction.guild) return false;

  if (interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
    return true;
  }

  let moderatorRole = null;
  if (process.env.MODERATOR_ROLE_ID) {
    moderatorRole = interaction.guild.roles.cache.get(process.env.MODERATOR_ROLE_ID) || null;
  }

  if (!moderatorRole) {
    const configuredName = (process.env.MODERATOR_ROLE_NAME || 'Moderator').toLowerCase();
    moderatorRole =
      interaction.guild.roles.cache.find(role => role.name.toLowerCase() === configuredName) ||
      interaction.guild.roles.cache.find(role => role.name.toLowerCase().includes('moderator')) ||
      null;
  }

  if (!moderatorRole) {
    return interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild) ||
      interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageMessages);
  }

  const rawRoles = interaction.member && interaction.member.roles;
  const roleIds = Array.isArray(rawRoles)
    ? rawRoles
    : rawRoles?.cache
      ? [...rawRoles.cache.keys()]
      : [];

  return roleIds.some(roleId => {
    const memberRole = interaction.guild.roles.cache.get(roleId);
    return memberRole && memberRole.position >= moderatorRole.position;
  });
}

// Define slash commands
const commands = [
  new SlashCommandBuilder()
    .setName('links')
    .setDescription('List official virtual airline websites'),
  new SlashCommandBuilder()
    .setName('roleslist')
    .setDescription('List all server roles (Moderator+ only)')
].map(command => command.toJSON());

// Register the command with Discord
if (!process.env.CLIENT_ID) {
  throw new Error('Missing CLIENT_ID environment variable');
}

if (!botToken) {
  throw new Error('Missing DISCORD_TOKEN (or TOKEN) environment variable');
}

const rest = new REST({ version: '10' }).setToken(botToken);

(async () => {
  try {
    const commandNames = commands.map(command => command.name).join(', ');
    console.log(`🔄 Registering slash commands: ${commandNames}`);

    const route = process.env.GUILD_ID
      ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
      : Routes.applicationCommands(process.env.CLIENT_ID);

    console.log(
      process.env.GUILD_ID
        ? `📍 Registering as guild commands for GUILD_ID=${process.env.GUILD_ID}`
        : '🌍 Registering as global commands (can take time to appear)'
    );

    await rest.put(
      route,
      { body: commands }
    );
    console.log('✅ Slash commands registered!');

    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: [] }
      );
      console.log('🧹 Cleared global commands to prevent duplicates with guild commands');
    }
  } catch (error) {
    console.error(error);
  }
})();

function splitLinesForEmbeds(lines, maxLength = MAX_EMBED_DESCRIPTION_LENGTH) {
  const chunks = [];
  let current = '';

  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length > maxLength) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : ['No roles found.'];
}

// Handle command interaction
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === 'links') {
      const linksEmbed = new EmbedBuilder()
        .setColor(0x1f6feb)
        .setTitle('SIA Virtual Official Links')
        .setDescription(
          [
            'Use the buttons below to open each official website.',
            '[Singapore Airlines Virtual](https://sia-virtual-4112e817.base44.app/)',
            '[FAA Virtual](https://faav-aviation-excellence-a28cb7d5.base44.app/)'
          ].join('\n')
        )
        .setFooter({ text: 'SIA Virtual Services' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Singapore Airlines Virtual')
          .setStyle(ButtonStyle.Link)
          .setURL('https://sia-virtual-4112e817.base44.app/'),
        new ButtonBuilder()
          .setLabel('FAA Virtual')
          .setStyle(ButtonStyle.Link)
          .setURL('https://faav-aviation-excellence-a28cb7d5.base44.app/')
      );

      await interaction.reply({ embeds: [linksEmbed], components: [row] });
      return;
    }

    if (interaction.commandName === 'roleslist') {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({
          content: 'This command only works inside a server.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (!isModeratorOrAbove(interaction)) {
        await interaction.reply({
          content: 'You need the Moderator role (or higher) to use this command.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const roles = interaction.guild.roles.cache
        .filter(role => role.name !== '@everyone')
        .sort((a, b) => b.position - a.position)
        .map((role, index) => `${index + 1}. **${role.name}** • \`${role.id}\``)
        .slice(0, 100);

      const chunks = splitLinesForEmbeds(roles);
      const embeds = chunks.map((chunk, index) =>
        new EmbedBuilder()
          .setColor(0x2b8a3e)
          .setTitle(`Server Roles • ${interaction.guild.name}`)
          .setDescription(chunk)
          .setFooter({
            text: `Page ${index + 1}/${chunks.length} • ${roles.length} roles shown`
          })
          .setTimestamp()
      );

      await interaction.reply({ embeds: [embeds[0]], flags: MessageFlags.Ephemeral });

      for (let i = 1; i < embeds.length; i += 1) {
        await interaction.followUp({ embeds: [embeds[i]], flags: MessageFlags.Ephemeral });
      }
    }
  } catch (error) {
    console.error('❌ Command handling error:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'Something went wrong while processing that command.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
});

client.once('clientReady', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(botToken);
