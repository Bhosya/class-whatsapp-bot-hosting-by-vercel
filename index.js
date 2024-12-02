const { Client, LocalAuth } = require("whatsapp-web.js");
const {
  deleteExpiredItems,
  getValidItems,
  deductWeeklyCash,
} = require("./functions");
const handleCommand = require("./commands");
const qrcode = require("qrcode-terminal");
const schedule = require("node-schedule");
const moment = require("moment");
const db = require("./db");
const { exec } = require("child_process");

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: "session" }),
  puppeteer: { args: ["--no-sandbox", "--disable-setuid-sandbox"] },
});

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("Client is ready!");
});

client.on("disconnected", (reason) => {
  console.error("Client disconnected:", reason);
  client.initialize();
});

client.initialize();

async function reminders(type) {
  const now = moment();
  const assignments = await getValidItems("assignments", now);
  const exams = await getValidItems("exams", now);
  const dayOfWeek = now.format("dddd").toLowerCase();

  const matkul = {
    sunday: [
      "6285869487547@c.us",
      "6281393583344@c.us",
      "6281325189462@c.us",
      "6281392238696@c.us",
    ],
    monday: [
      "6281328511065@c.us",
      "6282141562425@c.us",
      "6285643034733@c.us",
      "6281225895633@c.us",
      "6285643629721@c.us",
      "6282229961790@c.us",
      "6285647122833@c.us",
    ],
    tuesday: ["628895412074@c.us", "6281273899779@c.us"],
    wednesday: [
      "6282313479632@c.us",
      "6282283728758@c.us",
      "6285298545503@c.us",
      "6281882870773@c.us",
    ],
    thursday: ["6281285460353@c.us", "6281328928792@c.us"],
  };

  const contacts = matkul[dayOfWeek];

  if (type === "task") {
    const reminders = [
      ...assignments.filter((item) =>
        moment(item.deadline, "DD-MM-YYYY").isSame(
          now.clone().add(1, "days"),
          "day"
        )
      ),
      ...exams.filter((item) =>
        moment(item.deadline, "DD-MM-YYYY").isSame(
          now.clone().add(1, "days"),
          "day"
        )
      ),
    ];

    if (reminders.length > 0) {
      try {
        const chat = await client.getChatById("120363311807199707@g.us");
        reminders.forEach((item) => {
          const itemType = assignments.includes(item) ? "tugas" : "ujian";
          chat.sendMessage(
            `*Reminder ${itemType}*:\n\nGuys, 1 hari lagi ${itemType} ${item.title}.`
          );
        });
      } catch (error) {
        console.error("Error sending reminders:", error);
      }
    }
  } else if (type === "teacher" && contacts) {
    try {
      const chat = await client.getChatById("120363311807199707@g.us");

      const mentions = await Promise.all(
        contacts.map(async (contactId) => {
          try {
            return await client.getContactById(contactId);
          } catch (error) {
            console.error(`Error fetching contact ${contactId}:`, error);
            return null;
          }
        })
      ).then((results) => results.filter(Boolean));

      const mentionText = mentions
        .map((contact) => `@${contact.id.user}`)
        .join(" ");
      chat.sendMessage(
        `*Reminder chat dosen*:\n\n${mentionText}\nGuys, jangan lupa chat dosen buat matkul besok.`,
        { mentions }
      );
    } catch (error) {
      console.error("Error in teacher reminders:", error);
    }
  }
}

async function sendNewTasks() {
  try {
    // Execute the Python script
    exec("python elnino_scraper.py", (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing Python script: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`Python script stderr: ${stderr}`);
        return;
      }
      console.log(`Python script output: ${stdout}`);
    });

    // Fetch unsent tasks
    const [tasks] = await db.query(`SELECT * FROM tasks WHERE sent < 1`);

    if (tasks.length > 0) {
      for (const task of tasks) {
        if (!task.sent) {
          const message = `Tugas baru di ${task.course}:\n${task.name}\n${task.url}`;

          // Send message
          await client.sendMessage("6281882870773@c.us", message);
          console.log(`Message sent: ${message}`);

          // Update task as sent in the database
          await db.query(`UPDATE tasks SET sent = 1 WHERE id = ?`, [task.id]);
        }
      }
    } else {
      return;
    }
  } catch (error) {
    console.error("Error reading or sending tasks:", error);
  }
}

// Schedule tasks
schedule.scheduleJob("0 8 * * 0-4", async () => await reminders("teacher"));
schedule.scheduleJob("0 12 * * *", async () => await reminders("task"));
schedule.scheduleJob("0 0 * * 0", deductWeeklyCash);
schedule.scheduleJob("* * * * *", sendNewTasks);

client.on("message", async (msg) => {
  if (msg.body.startsWith(".")) {
    const sender = msg.author || msg.from;
    const contact = await msg.getContact();
    const username = contact.pushname || contact.number || sender;
    console.log(`@${username} used: ${msg.body}`);
  }

  deleteExpiredItems();

  if (msg.body === "@everyone") {
    const chat = await msg.getChat();
    if (chat.groupMetadata) {
      const participants = chat.groupMetadata.participants;
      const mentions = participants.map((p) => p.id._serialized);
      await chat.sendMessage("", { mentions });
    } else {
      console.log("Command ini hanya bisa dilakukan di grup.");
    }
  } else if (msg.body === "@creative") {
    const chat = await msg.getChat();
    const numbers = ["6281273899779@c.us", "6285869487547@c.us"];
    let text = numbers.map((num) => `@${num.split("@")[0]}`).join(" ");
    await chat.sendMessage(text, { mentions: numbers });
  } else if (msg.body === "@ketua") {
    const chat = await msg.getChat();
    const number = "6281804388638@c.us";
    const text = `@${number.split("@")[0]}`;
    await chat.sendMessage(text, { mentions: [number] });
  } else if (msg.body === "@wakil") {
    const chat = await msg.getChat();
    const number = "6281328511065@c.us";
    const text = `@${number.split("@")[0]}`;
    await chat.sendMessage(text, { mentions: [number] });
  } else if (msg.body === "@sekretaris") {
    const chat = await msg.getChat();
    const numbers = ["6282229961790@c.us", "6285647122833@c.us"];
    let text = numbers.map((num) => `@${num.split("@")[0]}`).join(" ");
    await chat.sendMessage(text, { mentions: numbers });
  } else if (msg.body === "@bendahara") {
    const chat = await msg.getChat();
    const numbers = ["628895412074@c.us", "6282141562425@c.us"];
    let text = numbers.map((num) => `@${num.split("@")[0]}`).join(" ");
    await chat.sendMessage(text, { mentions: numbers });
  } else if (msg.body === "@matdis") {
    const chat = await msg.getChat();
    const numbers = [
      "6281328511065@c.us",
      "6282141562425@c.us",
      "6285643034733@c.us",
    ];
    let text = numbers.map((num) => `@${num.split("@")[0]}`).join(" ");
    await chat.sendMessage(text, { mentions: numbers });
  } else if (msg.body === "@pancasila") {
    const chat = await msg.getChat();
    const numbers = ["6281325189462@c.us", "6281392238696@c.us"];
    let text = numbers.map((num) => `@${num.split("@")[0]}`).join(" ");
    await chat.sendMessage(text, { mentions: numbers });
  } else if (msg.body === "@alpro") {
    const chat = await msg.getChat();
    const numbers = ["628895412074@c.us", "6281273899779@c.us"];
    let text = numbers.map((num) => `@${num.split("@")[0]}`).join(" ");
    await chat.sendMessage(text, { mentions: numbers });
  } else if (msg.body === "@basda") {
    const chat = await msg.getChat();
    const numbers = ["6285869487547@c.us", "6281393583344@c.us"];
    let text = numbers.map((num) => `@${num.split("@")[0]}`).join(" ");
    await chat.sendMessage(text, { mentions: numbers });
  } else if (msg.body === "@indo") {
    const chat = await msg.getChat();
    const numbers = ["6281225895633@c.us", "6285643629721@c.us"];
    let text = numbers.map((num) => `@${num.split("@")[0]}`).join(" ");
    await chat.sendMessage(text, { mentions: numbers });
  } else if (msg.body === "@arsikom") {
    const chat = await msg.getChat();
    const numbers = ["6282229961790@c.us", "6285647122833@c.us"];
    let text = numbers.map((num) => `@${num.split("@")[0]}`).join(" ");
    await chat.sendMessage(text, { mentions: numbers });
  } else if (msg.body === "@desgraf") {
    const chat = await msg.getChat();
    const numbers = ["6282313479632@c.us", "6282283728758@c.us"];
    let text = numbers.map((num) => `@${num.split("@")[0]}`).join(" ");
    await chat.sendMessage(text, { mentions: numbers });
  } else if (msg.body === "@pti") {
    const chat = await msg.getChat();
    const numbers = ["6285298545503@c.us", "6281882870773@c.us"];
    let text = numbers.map((num) => `@${num.split("@")[0]}`).join(" ");
    await chat.sendMessage(text, { mentions: numbers });
  } else if (msg.body === "@so") {
    const chat = await msg.getChat();
    const numbers = ["6281285460353@c.us", "6281328928792@c.us"];
    let text = numbers.map((num) => `@${num.split("@")[0]}`).join(" ");
    await chat.sendMessage(text, { mentions: numbers });
  } else {
    await handleCommand(client, msg);
  }
});
