import requests
from bs4 import BeautifulSoup
import mysql.connector
import time

# Konstanta URL dan kredensial
LOGIN_URL = "https://elnino20212.polines.ac.id/login/index.php"
COURSE_URLS = {
    "Algoritma dan Pemrograman": "https://elnino20212.polines.ac.id/course/view.php?id=7116",
    "Desain Grafis dan Multimedia": "https://elnino20212.polines.ac.id/course/view.php?id=7130",
    "Pengantar Teknologi Informasi": "https://elnino20212.polines.ac.id/course/view.php?id=7145",
    "Sistem Basis Data": "https://elnino20212.polines.ac.id/course/view.php?id=7132"
}
USERNAME = "3.34.24.1.23"
PASSWORD = "Polines*2024"
CHECK_INTERVAL = 600  # 10 menit

# Koneksi ke database
def connect_to_db():
    return mysql.connector.connect(
        host="localhost",
        user="root",  # Ganti dengan username MySQL Anda
        password="",  # Ganti dengan password MySQL Anda
        database="whatsapp_bot"  # Ganti dengan nama database Anda
    )

# Login ke Moodle
def login_to_moodle():
    session = requests.Session()
    try:
        login_page = session.get(LOGIN_URL)
        soup = BeautifulSoup(login_page.text, "html.parser")
        token = soup.find("input", {"name": "logintoken"})["value"]

        payload = {
            "logintoken": token,
            "username": USERNAME,
            "password": PASSWORD,
        }
        response = session.post(LOGIN_URL, data=payload)
        if "Dasbor" in response.text:
            print("[INFO] Login berhasil.")
            return session
        else:
            print("[ERROR] Login gagal. Periksa kredensial Anda.")
            return None
    except Exception as e:
        print(f"[ERROR] Kesalahan saat login: {e}")
        return None

# Cek tugas baru dan simpan ke database
def check_new_tasks(session):
    new_tasks = []

    try:
        conn = connect_to_db()
        cursor = conn.cursor()

        for course_name, course_url in COURSE_URLS.items():
            response = session.get(course_url)
            soup = BeautifulSoup(response.text, "html.parser")
            tasks = soup.find_all("li", class_="activity assign modtype_assign")

            for task in tasks:
                task_name = task.find("span", class_="instancename").text.strip()
                task_url = task.find("a")["href"] if task.find("a") else None

                # Periksa apakah tugas sudah ada di database
                cursor.execute("SELECT COUNT(*) FROM tasks WHERE url = %s", (task_url,))
                task_exists = cursor.fetchone()[0]

                if not task_exists:
                    # Tambahkan tugas baru ke database
                    cursor.execute(
                        "INSERT INTO tasks (url, name, course) VALUES (%s, %s, %s)",
                        (task_url, task_name, course_name),
                    )
                    conn.commit()
                    new_tasks.append({"name": task_name, "url": task_url, "course": course_name})

        cursor.close()
        conn.close()
    except Exception as e:
        print(f"[ERROR] Gagal memeriksa tugas baru: {e}")

    return new_tasks

# Fungsi utama
def main():
    session = login_to_moodle()
    if not session:
        return

    while True:
        print("[INFO] Memeriksa tugas baru...")
        new_tasks = check_new_tasks(session)

        if new_tasks:
            print("[INFO] Tugas baru ditemukan!")
            for task in new_tasks:
                print(f" - {task['name']} ({task['course']}): {task['url']}")
        else:
            print("[INFO] Tidak ada tugas baru.")

        time.sleep(CHECK_INTERVAL)

if __name__ == "__main__":
    main()
