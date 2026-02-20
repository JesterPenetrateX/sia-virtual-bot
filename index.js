// SIA Virtual Bot Code with Slash Command
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionsBitField
} = require('discord.js');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

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
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('🔄 Registering slash commands...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log('✅ Slash commands registered!');
  } catch (error) {
    console.error(error);
  }
})();

// Handle command interaction
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

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
      await interaction.reply({ content: 'This command only works inside a server.', ephemeral: true });
      return;
    }

    if (!isModeratorOrAbove(interaction)) {
      await interaction.reply({
        content: 'You need the Moderator role (or higher) to use this command.',
        ephemeral: true
      });
      return;
    }

    const roles = interaction.guild.roles.cache
      .filter(role => role.name !== '@everyone')
      .sort((a, b) => b.position - a.position)
      .map((role, index) => `${index + 1}. ${role.name} (\`${role.id}\`)`)
      .slice(0, 100);

    const header = `📋 Roles in **${interaction.guild.name}** (${roles.length} shown):`;
    const body = roles.length > 0 ? roles.join('\n') : 'No roles found.';

    await interaction.reply({
      content: `${header}\n${body}`,
      ephemeral: true
    });
  }
});

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(process.env.TOKEN);
