require('dotenv').config({ path: '../../.env' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { setGlobalDispatcher, Agent } = require('undici');
setGlobalDispatcher(new Agent({ connect: { rejectUnauthorized: false } }));

const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const { prisma } = require('@cal-bot/db');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

const commands = [
  {
    name: 'calendar',
    description: 'Show interactive Discord Calendar',
  },
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  try {
    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: commands });
    console.log('Commands refreshed.');
    startReminderSchedule();
  } catch (error) {
    console.error(error);
  }
});

function generateCalendarText(year, month, events) {
  const eventDays = new Map();
  for (const e of events) {
    const d = new Date(e.startTime).getDate();
    eventDays.set(d, e.market || 'US');
  }

  const firstDay = new Date(year, month, 1).getDay();
  let offset = firstDay === 0 ? 6 : firstDay - 1; // Monday first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  let text = '\x1b[37m Mo   Tu   We   Th   Fr   Sa   Su \x1b[0m\n';
  let row = '';
  
  for (let i = 0; i < offset; i++) row += '     ';
  
  for (let d = 1; d <= daysInMonth; d++) {
    const dayOfWeek = (d + offset - 1) % 7; // 0=Mo, 5=Sa, 6=Su
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
    const hasEvent = eventDays.has(d);
    
    const dayStr = d.toString().padStart(2, '0');
    let cell = ` ${dayStr} `;
    
    if (isWeekend) {
      cell = `\x1b[35m[${dayStr}]\x1b[0m`; // Purple default for weekends
    } else if (hasEvent) {
      const market = eventDays.get(d);
      let colorCode = '\x1b[34m'; // Blue
      if (market === 'US') colorCode = '\x1b[34m';
      else if (market === 'INDO') colorCode = '\x1b[31m'; // Red
      else if (market === 'BOTH') colorCode = '\x1b[35m'; // Purple
      else if (market === 'PROJECTS') colorCode = '\x1b[32m'; // Green
      else if (market === 'OTHER') colorCode = '\x1b[33m'; // Yellow
      
      cell = `${colorCode}[${dayStr}]\x1b[0m`;
    }
    
    row += cell + ' ';
    
    if (dayOfWeek === 6) {
      text += row + '\n';
      row = '';
    }
  }
  if (row.length > 0) text += row + '\n';
  return '```ansi\n' + text + '```';
}

async function buildCalendarMessage(year, month) {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59);
  
  const events = await prisma.event.findMany({
    where: {
      startTime: { gte: startDate, lte: endDate }
    },
    orderBy: { startTime: 'asc' }
  });

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  const today = new Date();
  const todaysEvents = events.filter(e => {
    const d = new Date(e.startTime);
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  });

  let eventList = '';
  if (todaysEvents.length > 0) {
    eventList = `\n\n**📅 Today's Market Status:**\n`;
    todaysEvents.forEach(e => {
      let emoji = '🔵';
      if (e.market === 'INDO') emoji = '🔴';
      if (e.market === 'BOTH') emoji = '🟣';
      if (e.market === 'PROJECTS') emoji = '🟢';
      if (e.market === 'OTHER') emoji = '🟠';
      eventList += `${emoji} **${e.market} Market Closed:** ${e.title}\n`;
      if (e.description) {
        eventList += `> *${e.description.replace(/\n/g, '\n> ')}*\n\n`;
      }
    });
  } else {
    const isWeekend = today.getDay() === 0 || today.getDay() === 6;
    if (isWeekend) {
      eventList = `\n\n**📅 Today's Market Status:**\n🟣 **BOTH Markets Closed:** Weekend`;
    } else {
      eventList = `\n\n**📅 Today's Market Status:**\n✅ **All Markets are OPEN today.**`;
    }
  }

  const legend = `*(\`[ ]\` indicates market closed. 🔵=US, 🔴=INDO, 🟣=BOTH/Weekend)*`;
  
  const embed = new EmbedBuilder()
    .setTitle(`📈 Market Closed - ${monthNames[month]} ${year}`)
    .setDescription(generateCalendarText(year, month, events) + legend + eventList)
    .setColor('#0f172a');

  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth < 0) { prevMonth = 11; prevYear--; }
  
  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth > 11) { nextMonth = 0; nextYear++; }

  const components = [];

  // Dropdown for selecting event details
  if (events.length > 0) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`cal_select_${year}_${month}`)
      .setPlaceholder('Click here to view event details...')
      .addOptions(events.slice(0, 25).map(e => ({
        label: `[${new Date(e.startTime).getDate().toString().padStart(2, '0')}] ${e.title}`.substring(0, 100),
        description: `${e.market} Market - ${e.description || 'No description'}`.substring(0, 100),
        value: `evt_${e.id}`
      })));
    components.push(new ActionRowBuilder().addComponents(selectMenu));
  }

  // Buttons row
  const buttonRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder().setCustomId(`cal_prev_${prevYear}_${prevMonth}`).setLabel('⬅️ Prev').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`cal_next_${nextYear}_${nextMonth}`).setLabel('Next ➡️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`cal_add_${year}_${month}`).setLabel('➕ Add Event').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setLabel('🌐 Web Dashboard').setURL(process.env.NEXTAUTH_URL || 'http://localhost:3001').setStyle(ButtonStyle.Link)
    );
  
  components.push(buttonRow);

  return { embeds: [embed], components };
}

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'calendar') {
      // Cari channel #market-calendar di guild ini
      const marketCalChannel = interaction.guild?.channels.cache.find(
        (ch) => ch.name.toLowerCase() === 'market-calendar' && ch.isTextBased()
      );

      const now = new Date();
      const msgData = await buildCalendarMessage(now.getFullYear(), now.getMonth());

      if (marketCalChannel && marketCalChannel.id !== interaction.channelId) {
        // Kirim calendar grid ke #market-calendar
        await marketCalChannel.send(msgData);
        await interaction.reply({ content: `📅 Calendar telah dikirim ke <#${marketCalChannel.id}>!`, ephemeral: true });
      } else {
        // Jika sudah di #market-calendar atau channel tidak ditemukan, reply di sini
        await interaction.reply(msgData);
      }
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId.startsWith('cal_prev_') || interaction.customId.startsWith('cal_next_')) {
      const [, , year, month] = interaction.customId.split('_');
      const msgData = await buildCalendarMessage(parseInt(year), parseInt(month));
      await interaction.update(msgData);
    }

    if (interaction.customId.startsWith('cal_add_')) {
      const [, , year, month] = interaction.customId.split('_');
      
      const modal = new ModalBuilder()
        .setCustomId(`modal_add_${year}_${month}`)
        .setTitle('Create Market Closed Event');

      const titleInput = new TextInputBuilder().setCustomId('title').setLabel('Reason').setStyle(TextInputStyle.Short).setRequired(true);
      const dateInput = new TextInputBuilder().setCustomId('date').setLabel('Date (YYYY-MM-DD)').setStyle(TextInputStyle.Short).setValue(`${year}-${String(parseInt(month)+1).padStart(2, '0')}-01`).setRequired(true);
      const marketInput = new TextInputBuilder().setCustomId('market').setLabel('Market (US / INDO / BOTH)').setStyle(TextInputStyle.Short).setValue('US').setRequired(true);
      const descInput = new TextInputBuilder().setCustomId('description').setLabel('Additional Details').setStyle(TextInputStyle.Paragraph).setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(dateInput),
        new ActionRowBuilder().addComponents(marketInput),
        new ActionRowBuilder().addComponents(descInput)
      );

      await interaction.showModal(modal);
    }

    if (interaction.customId.startsWith('cal_delete_')) {
      const eventId = interaction.customId.replace('cal_delete_', '');
      try {
        await prisma.event.delete({ where: { id: eventId } });
        await interaction.update({ content: '✅ Event deleted successfully. (Use the /calendar command or prev/next to refresh)', embeds: [], components: [] });
      } catch (err) {
        await interaction.reply({ content: '❌ Error: Event not found or could not be deleted.', ephemeral: true });
      }
    }
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId.startsWith('cal_select_')) {
      const eventId = interaction.values[0].replace('evt_', '');
      const evt = await prisma.event.findUnique({ where: { id: eventId } });
      
      if (!evt) return interaction.reply({ content: 'Event not found.', ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle(`📌 Event Detail: ${evt.title}`)
        .setColor(evt.market === 'INDO' ? '#ef4444' : evt.market === 'BOTH' ? '#a855f7' : evt.market === 'PROJECTS' ? '#10b981' : evt.market === 'OTHER' ? '#f59e0b' : '#3b82f6')
        .addFields(
          { name: 'Market', value: evt.market, inline: true },
          { name: 'Date', value: `<t:${Math.floor(evt.startTime.getTime() / 1000)}:D>`, inline: true },
          { name: 'Description', value: evt.description || 'No additional details.' }
        );

      if (evt.image) {
        embed.setImage(evt.image);
      }

      const deleteBtnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`cal_delete_${eventId}`).setLabel('🗑️ Delete Event').setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({ embeds: [embed], components: [deleteBtnRow], ephemeral: true });
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('modal_add_')) {
      const [, , yearStr, monthStr] = interaction.customId.split('_');
      
      const title = interaction.fields.getTextInputValue('title');
      const date = interaction.fields.getTextInputValue('date');
      const marketVal = interaction.fields.getTextInputValue('market').toUpperCase();
      const description = interaction.fields.getTextInputValue('description');

      try {
        const startDateTime = new Date(`${date}T00:00:00`);
        const endDateTime = new Date(`${date}T23:59:59`);

        await prisma.event.create({
          data: {
            title,
            description,
            market: ["US", "INDO", "BOTH", "PROJECTS", "OTHER"].includes(marketVal) ? marketVal : "US",
            startTime: startDateTime,
            endTime: endDateTime,
            createdBy: interaction.user.id,
          }
        });

        const msgData = await buildCalendarMessage(parseInt(yearStr), parseInt(monthStr));
        await interaction.update(msgData);
        await interaction.followUp({ content: `✅ Market Closed **${title}** (${marketVal}) created!`, ephemeral: true });
      } catch (err) {
        await interaction.reply({ content: '❌ Error: Invalid date format or system error.', ephemeral: true });
      }
    }
  }
});

// ==========================================
// DAILY HOLIDAY REMINDER SYSTEM
// ==========================================

let lastReminderDate = null;

async function sendDailyReminder() {
  console.log("[Reminder] Running daily market holiday check...");
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    const todaysEvents = await prisma.event.findMany({
      where: {
        startTime: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });

    if (todaysEvents.length === 0) {
      console.log("[Reminder] No market holiday events today.");
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`⚠️ Hari Libur Pasar - ${today.toLocaleDateString('id-ID', { dateStyle: 'full' })}`)
      .setColor('#ef4444')
      .setTimestamp();

    let desc = "";
    todaysEvents.forEach(e => {
      let emoji = '🔵';
      if (e.market === 'INDO') emoji = '🔴';
      if (e.market === 'BOTH') emoji = '🟣';
      if (e.market === 'PROJECTS') emoji = '🟢';
      if (e.market === 'OTHER') emoji = '🟠';
      desc += `${emoji} **${e.market} Market - ${e.title}**\n`;
      if (e.description) {
        desc += `> *${e.description}*\n`;
      }
      desc += `\n`;
    });
    embed.setDescription(desc.trim());

    client.guilds.cache.forEach(async (guild) => {
      const generalChannel = guild.channels.cache.find(
        (ch) => ch.name.toLowerCase() === 'market-update' && ch.isTextBased()
      );

      if (generalChannel) {
        await generalChannel.send({ embeds: [embed] });
        console.log(`[Reminder] Sent daily reminder embed to guild: ${guild.name} in channel: ${generalChannel.name}`);
      } else {
        console.log(`[Reminder] Channel 'market-update' not found in guild: ${guild.name}`);
      }
    });
  } catch (error) {
    console.error("[Reminder] Error sending daily reminder:", error);
  }
}

function startReminderSchedule() {
  // Jalankan pengecekan setiap menit
  setInterval(async () => {
    const today = new Date();
    const currentHour = (today.getUTCHours() + 7) % 24;
    const currentMinute = today.getUTCMinutes();
    
    // Kirim setiap jam 05:00 pagi WIB
    if (currentHour === 5 && currentMinute === 0) {
      const dateStr = today.toISOString().split('T')[0];
      
      // Cek apakah sudah pernah kirim hari ini (menggunakan database agar persist saat restart)
      const existing = await prisma.event.findFirst({
        where: {
          title: `__reminder_sent_${dateStr}__`,
        }
      });

      if (!existing) {
        // Tandai sudah kirim hari ini
        try {
          await prisma.event.create({
            data: {
              title: `__reminder_sent_${dateStr}__`,
              startTime: new Date(),
              endTime: new Date(),
              market: 'SYSTEM',
              createdBy: 'system',
              visibility: 'hidden',
            }
          });
        } catch (e) {
          // Abaikan jika gagal buat marker (misal createdBy tidak valid)
          console.log('[Reminder] Could not create marker, using memory fallback.');
        }
        await sendDailyReminder();
      }
    }
  }, 60000);

  console.log("[Reminder] Schedule started. Reminder will be sent at 05:00 WIB.");
}

client.login(process.env.DISCORD_TOKEN);

// ==========================================
// LIGHTWEIGHT HTTP SERVER FOR RENDER KEEP-ALIVE
// ==========================================
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('CalBot is active and running!\n');
});
const port = process.env.PORT || 8080;
server.listen(port, () => {
  console.log(`[Keep-Alive] HTTP server listening on port ${port}`);
});
