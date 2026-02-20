// SIA Virtual Bot Code with Slash Command
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionsBitField,
  MessageFlags
} = require('discord.js');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const botToken = process.env.DISCORD_TOKEN || process.env.TOKEN;
const MAX_MESSAGE_LENGTH = 2000;

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

function splitIntoMessages(header, lines) {
  const messages = [];
  let current = header;

  if (lines.length === 0) {
    return [`${header}\nNo roles found.`];
  }

  for (const line of lines) {
    const next = `${current}\n${line}`;
    if (next.length > MAX_MESSAGE_LENGTH) {
      messages.push(current);
      current = line;
    } else {
      current = next;
    }
  }

  if (current) messages.push(current);
  return messages;
}

// Handle command interaction
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === 'links') {
      await interaction.reply(
        "🌐 Official Virtual Airline Websites:\n" +
        "• Singapore Airlines Virtual: https://sia-virtual-4112e817.base44.app/\n" +
        "• FAA Virtual (Founded by SIA Virtual): https://faav-aviation-excellence-a28cb7d5.base44.app/"
      );
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
        .map((role, index) => `${index + 1}. ${role.name} (\`${role.id}\`)`)
        .slice(0, 100);

      const header = `📋 Roles in **${interaction.guild.name}** (${roles.length} shown):`;
      const messages = splitIntoMessages(header, roles);

      await interaction.reply({
        content: messages[0],
        flags: MessageFlags.Ephemeral
      });

      for (let i = 1; i < messages.length; i += 1) {
        await interaction.followUp({
          content: messages[i],
          flags: MessageFlags.Ephemeral
        });
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
