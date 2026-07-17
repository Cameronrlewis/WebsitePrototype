from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "output" / "pdf"
OUT_FILE = OUT_DIR / "cameron-lewis-resume-improved.pdf"

PAGE_W, PAGE_H = letter
LEFT = 44
RIGHT = PAGE_W - 44
SECTION_GREY = colors.HexColor("#d9d9d9")
TEXT = colors.HexColor("#222222")
MUTED = colors.HexColor("#5f5f5f")


def text_width(value, font, size):
    return canvas.Canvas(None).stringWidth(value, font, size)


def wrap_text(value, font, size, max_width):
    words = value.split()
    lines = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if text_width(candidate, font, size) <= max_width:
            current = candidate
            continue
        if current:
            lines.append(current)
        current = word
    if current:
        lines.append(current)
    return lines


def draw_section(c, title, y):
    c.setFillColor(SECTION_GREY)
    c.rect(LEFT, y - 12, RIGHT - LEFT, 14, fill=1, stroke=0)
    c.setFillColor(TEXT)
    c.setFont("Helvetica-BoldOblique", 10.5)
    c.drawString(LEFT + 1, y - 9.5, title)
    return y - 24


def draw_wrapped(c, value, x, y, width, font="Helvetica", size=9.5, leading=10.6):
    c.setFillColor(TEXT)
    c.setFont(font, size)
    for line in wrap_text(value, font, size, width):
        c.drawString(x, y, line)
        y -= leading
    return y


def draw_bullets(c, bullets, y, x=LEFT, width=None, size=8.95, leading=9.8):
    if width is None:
        width = RIGHT - LEFT - 18
    bullet_x = x + 1.5
    text_x = x + 16
    for bullet in bullets:
        lines = wrap_text(bullet, "Helvetica", size, width)
        c.setFillColor(TEXT)
        c.circle(bullet_x, y + 2.6, 1.1, fill=1, stroke=0)
        c.setFont("Helvetica", size)
        for line in lines:
            c.drawString(text_x, y, line)
            y -= leading
    return y


def draw_role(c, title, company, location, dates, bullets, y):
    c.setFillColor(TEXT)
    c.setFont("Helvetica-Bold", 10.2)
    c.drawString(LEFT, y, title)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 9.4)
    c.drawRightString(RIGHT, y, dates)
    y -= 10.6
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 9.7)
    c.drawString(LEFT, y, f"{company}  -  {location}")
    y -= 11.1
    y = draw_bullets(c, bullets, y)
    return y - 0.7


def draw_project(c, title, dates, bullets, y):
    c.setFillColor(TEXT)
    c.setFont("Helvetica-Bold", 10.1)
    c.drawString(LEFT, y, title)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 9.4)
    c.drawRightString(RIGHT, y, dates)
    y -= 10.5
    y = draw_bullets(c, bullets, y, size=8.9, leading=9.6)
    return y + 0.5


def build():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUT_FILE), pagesize=letter)
    c.setTitle("Cameron Lewis Resume")
    c.setFillColor(colors.white)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    y = PAGE_H - 54
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 35)
    c.drawString(LEFT, y, "CAMERON LEWIS")
    y -= 24
    c.setFont("Helvetica-Bold", 14.5)
    c.drawString(LEFT, y, "ELECTRICAL ENGINEERING STUDENT")
    y -= 14
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 9.8)
    c.drawString(
        LEFT,
        y,
        "St John's, NL  |  Cameronrl@mun.ca  |  linkedin.com/in/cameron-lewis-  |  github.com/Cameronrlewis",
    )
    y -= 8
    c.setStrokeColor(colors.HexColor("#cccccc"))
    c.line(LEFT, y, RIGHT, y)
    y -= 18

    y = draw_section(c, "SUMMARY", y)
    y = draw_wrapped(
        c,
        "Electrical Engineering student at Memorial University with hands-on industry experience in PCB design, wiring harnesses, and embedded systems. Proven ability to deliver in fast-paced, multidisciplinary environments, with a strong foundation in hardware design, technical documentation, and cross-disciplinary collaboration.",
        LEFT,
        y,
        RIGHT - LEFT,
        size=9.5,
        leading=10.4,
    )
    y -= 6

    y = draw_section(c, "TECHNICAL SKILLS", y)
    skill_columns = [
        ["Altium / KiCad", "PCB Design & Assembly", "Analog & Digital Circuits"],
        ["LTspice / PSPICE", "Oscilloscope & Logic Analyzer", "Onshape CAD"],
        ["C / C++  |  Python  |  MATLAB", "Arduino IDE  |  Git", "Soldering & Hardware Testing"],
    ]
    start_y = y - 8
    col_w = (RIGHT - LEFT) / 3
    c.setFont("Helvetica", 9.8)
    c.setFillColor(TEXT)
    for col, skills in enumerate(skill_columns):
        x = LEFT + col * col_w + (4 if col else 0)
        sy = start_y
        for skill in skills:
            c.drawString(x, sy, skill)
            sy -= 18
    y = start_y - 54

    y = draw_section(c, "PROFESSIONAL EXPERIENCE", y)
    y = draw_role(
        c,
        "Electrical Engineering Student - Co-op",
        "Kraken Robotics Systems Inc.",
        "Mount Pearl, NL",
        "January 2026 - April 2026",
        [
            "Assisted in PCB design using Altium for subsea systems including Synthetic Aperture Sonar, Katfish ROTV, and SeaPower Batteries, delivering designs that met manufacturability and customer needs across product lines.",
            "Redesigned wiring harness layouts by incorporating signal integrity best practices and direct engineer feedback, reducing potential failure points in cable assemblies.",
            "Maintained technical documentation for 5+ products using PDM software, enabling accurate version control and streamlining design review approvals.",
        ],
        y,
    )
    y = draw_role(
        c,
        "Electrical Team Member",
        "Paradigm Engineering - MUN Student Design Team",
        "St. John's, NL",
        "September 2025 - Present",
        [
            "Designed multilayer control PCBs integrating microcontrollers, power-management circuits, and voltage regulators using KiCad for an autonomous competition kart.",
            "Collaborated in a multidisciplinary team to ensure hardware integration across mechanical and software sub-teams under competition deadlines.",
            "Attended Autonomous Karting Series 2026 as lead designer of the Auxiliary Control Board PCB, managing power distribution with LDOs, level shifters, and protection circuitry.",
        ],
        y,
    )
    y -= 4

    y = draw_section(c, "PROJECTS", y)
    y = draw_project(
        c,
        "Thermal Camera",
        "February 2026 - Present",
        [
            "ESP32-based thermal imaging camera with an IR sensor array that outputs a real-time heat map for temperature visualization.",
            "Prototype-stage embedded imaging system focused on sensor readout, display mapping, and compact hardware integration.",
        ],
        y,
    )
    y = draw_project(
        c,
        "Auxiliary Control Board (Paradigm)",
        "February 2026 - March 2026",
        [
            "Custom auxiliary control PCB for Paradigm's autonomous kart, managing regulated power, signal translation, and protection circuitry.",
            "Board-level control module with LDO rails, level shifters, and subsystem interfaces for reliable multi-rail power delivery.",
        ],
        y,
    )
    y = draw_project(
        c,
        "Brick Buck Power Board (Paradigm)",
        "April 2026",
        [
            "Backup competition power board combining a premade 48V-to-12V DC-DC brick with a custom on-board 12V-to-5V buck stage.",
            "Swap-ready power module matched to the kart's existing subsystem harnesses for rapid replacement during competition.",
        ],
        y,
    )
    y -= 4

    y = draw_section(c, "EDUCATION", y)
    c.setFillColor(TEXT)
    c.setFont("Helvetica-Bold", 10.1)
    c.drawString(LEFT, y, "Bachelor of Engineering (Co-op) - Electrical Engineering")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 9.4)
    c.drawRightString(RIGHT, y, "2024 - Present")
    y -= 10.5
    c.drawString(LEFT, y, "Memorial University of Newfoundland  -  Class of 2029  -  GPA 3.8  -  Dean's List 2024-2025")
    y -= 14.5
    c.setFillColor(TEXT)
    c.setFont("Helvetica-Bold", 10.1)
    c.drawString(LEFT, y, "High School Diploma")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 9.4)
    c.drawRightString(RIGHT, y, "2018 - 2024")
    y -= 10.5
    c.drawString(LEFT, y, "Roncalli Central High School  -  Salutatorian  -  GPA 4.0  -  Teachers' Academic Award")
    y -= 24

    y = draw_section(c, "ACHIEVEMENTS & INTERESTS", y)
    c.setFillColor(TEXT)
    c.setFont("Helvetica-Bold", 10.1)
    c.drawString(LEFT, y, "Table Tennis - Team NL")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 9.4)
    c.drawRightString(RIGHT, y, "May 2025")
    y -= 10.5
    y = draw_wrapped(
        c,
        "Represented Newfoundland & Labrador at the Atlantic Tournament in Halifax against all Atlantic provinces.",
        LEFT,
        y,
        RIGHT - LEFT,
        size=9.35,
        leading=10,
    )
    y -= 8
    c.setFillColor(TEXT)
    c.setFont("Helvetica-Bold", 10.1)
    c.drawString(LEFT, y, "NLTTA Regional Representative")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 9.4)
    c.drawRightString(RIGHT, y, "2026 - Present")
    y -= 10.5
    draw_wrapped(
        c,
        "Mt. Pearl South/Paradise representative for the Newfoundland Table Tennis Association.",
        LEFT,
        y,
        RIGHT - LEFT,
        size=9.35,
        leading=10,
    )

    c.save()
    print(OUT_FILE)


if __name__ == "__main__":
    build()
