const moment = require("moment");
const {
  addItem,
  getValidItems,
  deleteItem,
  addCash,
  incrementAllCash,
} = require("./functions");
const db = require("./db");

const roles = {
  owner: ["6281882870773@c.us", "6285701376874@c.us"],
  sekretaris: ["6285647122833@c.us", "6282229961790@c.us"],
  bendahara: ["6282141562425@c.us", "628895412074@c.us"],
};

function hasPermission(sender, role) {
  return role == "sekretaris"
    ? roles.sekretaris.includes(sender) || roles.owner.includes(sender)
    : roles.bendahara.includes(sender) || roles.owner.includes(sender);
}

async function handleCommand(client, msg) {
  const [command, ...args] = msg.body.slice(1).split(" ");
  const sender = msg.author || msg.from;
  const title = args[0] && args[0].toLowerCase();

  if (
    !hasPermission(sender, "sekretaris") &&
    ["tugasbaru", "hapustugas", "ujianbaru", "hapusujian"].includes(command)
  ) {
    return client.sendMessage(msg.from, "Ehhh kamu gabisa pake perintah itu.");
  } else if (
    !hasPermission(sender, "bendahara") &&
    ["kas", "kassemua"].includes(command)
  ) {
    return client.sendMessage(msg.from, "Mau ngapain kamu.");
  }

  switch (command) {
    case "help":
      client.sendMessage(
        msg.from,
        "*Perintah yang tersedia*:\n\nSekretaris:\n.tugasbaru <matkul> <deadline> <detail>\n.hapustugas <matkul>\n.ujianbaru <matkul> <deadline> <detail>\n.hapusujian <matkul>\n\nBendahara:\n.kas <nama>\n.tambahkas <nama>\n\nMahasiswa:\n.infotugas\n.detailtugas <matkul>\n.infoujian\n.detailujian <matkul>\n.infokas"
      );
      break;

    case "tugasbaru":
    case "ujianbaru":
      const [deadline, ...details] = args.slice(1);
      if (!moment(deadline, "DD-MM-YYYY").isValid()) {
        return client.sendMessage(
          msg.from,
          "Format tanggal salah. Harusnya DD-MM-YYYY."
        );
      }
      await addItem(
        command === "tugasbaru" ? "assignments" : "exams",
        title,
        deadline,
        details.join(" ")
      );
      client.sendMessage(
        msg.from,
        `${command === "tugasbaru" ? "Tugas" : "Ujian"} ${title} ditambahkan.`
      );
      break;

    case "hapustugas":
    case "hapusujian":
      const itemType = command === "hapustugas" ? "assignments" : "exams";

      const validItems = await getValidItems(itemType);
      const itemExists = validItems.some(
        (item) => item.title.toLowerCase() === title.toLowerCase()
      );

      if (!itemExists) {
        client.sendMessage(
          msg.from,
          `Tidak ada ${
            command === "hapustugas" ? "tugas" : "ujian"
          } dengan nama ${title}.`
        );
      } else {
        await deleteItem(
          command === "hapustugas" ? "assignments" : "exams",
          title
        );
        client.sendMessage(
          msg.from,
          `${command === "hapustugas" ? "Tugas" : "Ujian"} ${title} dihapus.`
        );
      }
      break;

    case "infotugas":
      const assignments = await getValidItems("assignments");
      client.sendMessage(
        msg.from,
        assignments.length
          ? "*Daftar tugas IK-1B*:\n\n" +
              assignments
                .map((a, i) => {
                  const formattedDate = new Date(a.deadline).toLocaleDateString(
                    "en-GB"
                  );
                  return `${i + 1}. ${a.title} - ${formattedDate}`;
                })
                .join("\n")
          : "Tidak ada tugas 😔"
      );
      break;

    case "detailtugas":
      const assignment = (await getValidItems("assignments")).find(
        (item) => item.title === title
      );
      msg.reply(
        assignment
          ? `*Detail tugas ${assignment.title}*: \n\n${assignment.details}`
          : "Gada tugas dengan nama itu."
      );
      break;

    case "infoujian":
      const exams = await getValidItems("exams");
      client.sendMessage(
        msg.from,
        exams.length
          ? "*Daftar ujian IK-1B*:\n\n" +
              exams
                .map((a, i) => {
                  const formattedDate = new Date(a.deadline).toLocaleDateString(
                    "en-GB"
                  );
                  return `${i + 1}. ${a.title} - ${formattedDate}`;
                })
                .join("\n")
          : "Tidak ada ujian 😔"
      );
      break;

    case "detailujian":
      const exam = (await getValidItems("exams")).find(
        (item) => item.title === title
      );
      msg.reply(
        exam
          ? `*Detail ujian ${exam.title}*: \n\n${exam.details}`
          : "Gada ujian dengan nama itu."
      );
      break;

    case "kas":
      const name = args[0]?.toLowerCase();
      const amount = parseInt(args[1]) || 1;
      if (name) {
        await addCash(name, amount);
        client.sendMessage(
          msg.from,
          `${name} bayar kas untuk ${amount} minggu.`
        );
      } else {
        client.sendMessage(
          msg.from,
          "Format salah. Gunakan: .kas <nama> [jumlah]"
        );
      }
      break;

    case "infokas":
      const sql = "SELECT name, week FROM cash";
      try {
        const [cashData] = await db.query(sql);
        const cashInfo = cashData
          .map((member, i) => {
            if (member.week === 0) {
              return `${i + 1}. sudah lunas - ${member.name.toUpperCase()}`;
            } else if (member.week > 0) {
              return `${i + 1}. lebih ${
                member.week
              } minggu - ${member.name.toUpperCase()}`;
            } else {
              return `${i + 1}. kurang ${Math.abs(
                member.week
              )} minggu - ${member.name.toUpperCase()}`;
            }
          })
          .join("\n");

        client.sendMessage(msg.from, `*Info Kas Kelas*:\n\n${cashInfo}`);
      } catch (err) {
        console.error("Error fetching cash info:", err);
      }
      break;

    case "kassemua":
      const amounts = parseInt(args[0]);
      if (amounts) {
        await incrementAllCash(amounts);
        client.sendMessage(msg.from, `Tidak ada kas selama ${amounts} minggu.`);
        break;
      } else {
        client.sendMessage(
          msg.from,
          "Format salah. Gunakan: .kassemua <jumlah>"
        );
      }
  }
}

module.exports = handleCommand;
