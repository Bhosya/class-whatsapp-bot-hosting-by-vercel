const moment = require("moment");
const db = require("./db");

// Fungsi untuk menambah item (tugas atau ujian)
async function addItem(tableName, title, deadline, details) {
  try {
    const formattedDeadline = moment(deadline, "DD-MM-YYYY").format(
      "YYYY-MM-DD"
    );
    await db.query(
      `INSERT INTO ?? (title, deadline, details) VALUES (?, ?, ?)`,
      [tableName, title, formattedDeadline, details]
    );
  } catch (error) {
    console.error("Error adding item:", error);
  }
}

// Fungsi untuk mendapatkan item yang masih valid (belum melewati deadline)
async function getValidItems(tableName) {
  try {
    const currentDate = moment().format("YYYY-MM-DD");
    const [rows] = await db.query(
      `SELECT * FROM ?? WHERE deadline >= ? ORDER BY deadline ASC`,
      [tableName, currentDate]
    );
    return rows;
  } catch (error) {
    console.error("Error retrieving valid items:", error);
    return [];
  }
}

// Fungsi untuk menghapus item berdasarkan judul
async function deleteItem(tableName, title) {
  try {
    await db.query(`DELETE FROM ?? WHERE LOWER(title) = LOWER(?)`, [
      tableName,
      title,
    ]);
  } catch (error) {
    console.error("Error deleting item:", error);
  }
}

// Fungsi untuk menghapus item yang sudah kadaluarsa
async function deleteExpiredItems() {
  try {
    const currentDate = moment().format("YYYY-MM-DD");
    await db.query(`DELETE FROM assignments WHERE deadline < ?`, [currentDate]);
    await db.query(`DELETE FROM exams WHERE deadline < ?`, [currentDate]);
  } catch (error) {
    console.error("Error deleting expired items:", error);
  }
}

// Fungsi untuk mengurangi saldo mingguan dari kas
async function deductWeeklyCash() {
  try {
    await db.query("UPDATE cash SET week = GREATEST(week - 1, 0)");
  } catch (error) {
    console.error("Error deducting weekly cash:", error);
  }
}

async function addCash(member, amount = 1) {
  try {
    await db.query(`UPDATE cash SET week = week + ? WHERE name = ?`, [
      amount,
      member,
    ]);
  } catch (error) {
    console.error("Error adding item:", error);
  }
}

async function incrementAllCash(amount = 1) {
  try {
    await db.query(`UPDATE cash SET week = week + ?`, [amount]);
  } catch (error) {
    console.error("Error adding item:", error);
  }
}

module.exports = {
  addItem,
  addCash,
  incrementAllCash,
  getValidItems,
  deleteItem,
  deleteExpiredItems,
  deductWeeklyCash,
};
