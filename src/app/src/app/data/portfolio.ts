export type PageId =
  | "home"
  | "experience"
  | "projects"
  | "skills"
  | "education"
  | "contact"
  | "updates";

export type ProjectStatus = "in-progress" | "completed" | "";
export type OrganizationKind = "team" | "work" | "personal" | "coursework";

export interface SocialLink {
  label: string;
  value: string;
  href: string;
}

export interface StatRecord {
  label: string;
  value: string;
  detail: string;
}

export interface ProfileRecord {
  name: string;
  initials: string;
  headline: string;
  typedPhrases: string[];
  school: string;
  availability: string;
  location: string;
  email: string;
  liveSite: string;
  summary: string;
  about: string[];
}

export interface ExperienceRecord {
  company: string;
  role: string;
  location: string;
  period: string;
  logo: string;
  marker: string;
  bullets: string[];
  tags: string[];
}

export interface EducationRecord {
  institution: string;
  credential: string;
  period: string;
  gpa: string;
  description: string;
  highlights: string[];
}

export interface ProjectRecord {
  id: number;
  slug: string;
  organizationId: string;
  title: string;
  category: string;
  status: ProjectStatus;
  featured: boolean;
  description: string;
  tags: string[];
  cardImg?: string;
  bannerImg?: string;
  hoverImg?: string;
  cardBackground?: string;
  cardImgPosition?: string;
  hoverImgPosition?: string;
  cardContain?: boolean;
  cardScale?: number;
  hoverContain?: boolean;
  hoverScale?: number;
  hoverPreviewWidth?: number;
  hoverPreviewHeight?: number;
  hoverMediaHeight?: number;
  hoverBackground?: string;
  modalContain?: boolean;
  modalScale?: number;
  modalImgPosition?: string;
  modalBackground?: string;
  github?: string | null;
  demo?: string | null;
  reportAsset?: string;
  reportPages?: string[];
  viewer3d?: boolean;
  viewerMode?: "bundle" | "wrl";
  viewerAsset?: "power" | "control" | "brick";
  viewerModelUrl?: string;
  bomUrl?: string;
  designDecisions?: string;
  challenges: string;
  takeaways: string;
}

export interface OrganizationBuildRecord {
  id: string;
  title: string;
  period: string;
  summary: string;
  bullets: string[];
  tags: string[];
  media?: string;
  mediaBackground?: string;
  mediaContain?: boolean;
  mediaPosition?: string;
  projectSlug?: string;
}

export interface OrganizationRecord {
  id: string;
  name: string;
  kind: OrganizationKind;
  role: string;
  period: string;
  cardSummary: string;
  overview: string[];
  tags: string[];
  logo?: string;
  monogram?: string;
  builds: OrganizationBuildRecord[];
}

const assetBase = "/portfolio/assets";

const reportPages = Array.from({ length: 28 }, (_, index) => {
  const page = String(index + 1).padStart(2, "0");
  return `${assetBase}/media/reports/engineering-1030/page-${page}.jpg`;
});

export const documents = {
  resume: `${assetBase}/documents/resume/cameron-lewis-resume.pdf`,
  resumePreview: `${assetBase}/media/documents/resume-preview-page-1.png`,
  engineeringReport: `${assetBase}/documents/reports/engineering-1030-project-report.pdf`,
};

export const socialLinks: SocialLink[] = [
  {
    label: "Email",
    value: "Cameronrl@mun.ca",
    href: "mailto:Cameronrl@mun.ca",
  },
  {
    label: "GitHub",
    value: "github.com/Cameronrlewis",
    href: "https://github.com/Cameronrlewis",
  },
  {
    label: "LinkedIn",
    value: "linkedin.com/in/cameronrlewis",
    href: "https://www.linkedin.com/in/cameronrlewis",
  },
  {
    label: "Live Site",
    value: "cameronlewis.dev",
    href: "https://cameronlewis.dev",
  },
];

export const profile: ProfileRecord = {
  name: "Cameron Lewis",
  initials: "CL",
  headline: "Electrical Engineering Student",
  typedPhrases: ["Electrical Engineering Student", "PCB Design Builder", "Embedded Systems Teammate"],
  school: "Memorial University of Newfoundland",
  availability: "Available for internships",
  location: "St. John's, NL, Canada",
  email: "Cameronrl@mun.ca",
  liveSite: "https://cameronlewis.dev",
  summary:
    "Second-year electrical engineering student focused on PCB design, embedded systems, and hardware development.",
  about: [
    "I'm Cameron Lewis, a second-year Electrical Engineering student at Memorial University focused on PCB design, embedded systems, and hardware development. I care about understanding how things work at a circuit level and building things that hold up in the real world.",
    "It started with building my first PC at age 11. That curiosity grew into a serious interest in electronics and I've since worked through analog circuit design, signal processing, and embedded firmware. Most recently I completed a co-op term at Kraken Robotics, getting hands-on exposure to professional hardware development.",
    "Outside the lab, I play competitive table tennis and have previously represented Team Newfoundland at the Atlantic Championships. I also contribute to Paradigm Engineering, MUN's student design team, where I work on electrical systems for our autonomous kart entry.",
  ],
};

export const stats: StatRecord[] = [
  { label: "GPA", value: "3.8", detail: "out of 4.0" },
  { label: "Projects", value: "6", detail: "documented builds" },
  { label: "Experience", value: "2", detail: "engineering roles" },
  { label: "Grad Date", value: "2029", detail: "expected B.Eng" },
];

export const experience: ExperienceRecord[] = [
  {
    company: "Kraken Robotics Systems Inc.",
    role: "Electrical Engineering Student",
    location: "Mount Pearl, NL",
    period: "January 2026 — April 2026",
    logo: `${assetBase}/media/experience/kraken-logo.png`,
    marker: `${assetBase}/media/experience/kraken-marker.png`,
    bullets: [
      "Assisted in the design and development of PCBs for subsea robotics systems including Synthetic Aperture Sonar and Katfish ROTV, ensuring functionality, reliability, and manufacturability.",
      "Contributed to the design of wiring harnesses and cable assemblies, considering signal integrity and incorporating feedback from engineers specializing in the respective subsystems.",
      "Developed and maintained technical documentation including schematics, drawings, and procedures using Product Data Management software for accurate version control.",
      "Assisted in developing test plans, conducting validation testing, and providing technical support to the production department during manufacturing.",
      "Collaborated cross-functionally with mechanical, software, systems, and production teams in weekly engineering meetings and design reviews.",
    ],
    tags: ["Altium", "PCB Design", "Wiring Harnesses", "Subsea Systems", "Technical Documentation"],
  },
  {
    company: "Paradigm Engineering — MUN Student Design Team",
    role: "Electrical Team Member",
    location: "St. John's, NL",
    period: "September 2025 — Present",
    logo: `${assetBase}/media/experience/paradigm-logo.png`,
    marker: `${assetBase}/media/experience/paradigm-marker.png`,
    bullets: [
      "Active member of the electrical sub-team designing and developing systems for an autonomous kart competing in the Autonomous Kart Series (AKS).",
      "Contributing to PCB design, power distribution, and embedded systems integration for the vehicle's autonomous control architecture.",
      "Collaborating cross-functionally with mechanical and software sub-teams to deliver integrated hardware solutions under competition deadlines.",
    ],
    tags: ["PCB Design", "Autonomous Systems", "Embedded Systems", "KiCad", "Team Collaboration"],
  },
];

export const skillSets = {
  electrical: [
    "PCB Design (Altium/KiCad)",
    "Analog Circuit Design",
    "Oscilloscope / Logic Analyzer",
    "Power Electronics",
    "LTspice",
  ],
  software: ["C / C++", "Python", "MATLAB / Simulink", "Git / Version Control", "Arduino IDE"],
};

export const softSkills = [
  "Problem Decomposition",
  "Technical Documentation",
  "Multi Disciplinary Collaboration",
  "Adaptability and Continuous Learning",
  "Agile / Scrum",
];

export const education: EducationRecord[] = [
  {
    institution: "Memorial University of Newfoundland",
    credential: "B.Eng Electrical Engineering",
    period: "2024 — Present",
    gpa: "GPA 3.8 / 4.0",
    description:
      "Concentrating in Circuits and Power Systems. Active electrical member of Paradigm Engineering.",
    highlights: ["Dean's List — 2024-2025", "3rd Place Python Project Award in Verafin Hosted Competition", "Paradigm Electrical Member"],
  },
  {
    institution: "Roncalli Central Highschool",
    credential: "High School Diploma",
    period: "2018 — 2024",
    gpa: "GPA 4.0 / 4.0",
    description:
      "Graduated salutatorian with a focus on advanced mathematics and physics while training for provincial competition.",
    highlights: ["Salutatorian", "Teachers' Academic Award"],
  },
];

export const coursework = [
  "ECE-3300 — Circuits & Electronics",
  "ECE-3400 — Foundations of Programming (C++)",
  "ECE-3500 — Digital Logic",
  "PHYS-3000 — Physics of Device Materials",
  "ENGI-1020 — Introduction to Programming (Python)",
  "ENGI-1030 — Graphics & 3D Design",
  "ENGI-1050 — Circuits",
  "MATH-2050 — Linear Algebra",
];

export const graduation = {
  label: "Expected Graduation",
  date: "January 2029",
  detail: "B.Eng. Electrical Engineering",
};

export const organizationKindLabel: Record<OrganizationKind, string> = {
  team: "Team",
  work: "Work",
  personal: "Personal",
  coursework: "Coursework",
};

export const projects: ProjectRecord[] = [
  {
    id: 1,
    slug: "thermal-camera",
    organizationId: "personal-lab",
    title: "Thermal Camera",
    category: "Microcontroller Systems",
    status: "in-progress",
    featured: true,
    cardImg: `${assetBase}/media/projects/thermal-camera-schematic-card.png`,
    hoverImg: `${assetBase}/media/projects/thermal-camera-schematic-hover.png`,
    cardBackground: "#f5f4ef",
    cardContain: true,
    cardScale: 0.88,
    hoverContain: true,
    hoverScale: 0.88,
    hoverBackground: "#f5f4ef",
    modalContain: true,
    modalScale: 0.88,
    modalBackground: "#f5f4ef",
    description:
      "A personal project building a handheld thermal imaging camera from scratch using an ESP32 microcontroller and a low-cost infrared sensor array.",
    tags: ["ESP32", "ILI9341 LCD Screen", "MLX90640 Thermal Sensor"],
    github: "https://github.com/Cameronrlewis/Thermal-Camera-Project",
    designDecisions:
      "The ESP32 was chosen as the core processor for its dual-core architecture and how easily its configurability allows sensor polling and display rendering to run in parallel without blocking each other. Its native SPI and I2C peripheral support simplified the hardware interface to both the IR sensor array and the colour display, reducing the amount of manual bit-banging needed at the firmware level. The mature development ecosystem around the ESP32 was equally important, as having reliable community libraries for display drivers and sensor communication meant the early stages of the build could focus on system-level integration rather than low-level peripheral bring-up.\n\nThe AMG8833 IR array was selected for its I2C simplicity and its 8x8 native resolution, which provides a 64-point temperature grid that the firmware scales up through bicubic interpolation into a smooth, readable colour map. The colour palette is computed from a pre-built lookup table rather than floating-point math at runtime, which keeps the rendering loop tight enough to maintain a responsive frame rate within the microcontroller's clock constraints. Power architecture was deliberately kept simple with a single lithium cell and a 3.3V LDO, prioritising a compact BOM and a portable form factor over the added complexity of a switching regulator for a device that draws modest current.",
    challenges:
      "With the schematic complete and the layout now underway, the main challenge is translating the design intent into a physical board that meets the project's size and thermal constraints. The IR sensor needs to be positioned far enough from the display, voltage regulator, and battery that their radiated heat does not introduce offset errors in the temperature readings, but the enclosure target is compact enough that every millimetre of separation has to be justified. Routing the SPI bus to the display and the I2C bus to the sensor cleanly on a two-layer board while maintaining short return paths and avoiding crosstalk between the high-speed display lines and the sensitive analog sensor traces is the central layout challenge at this stage.\n\nOn the firmware side, the interpolation and colour-mapping pipeline will need careful profiling once hardware is in hand. The bicubic interpolation that makes the thermal image usable adds meaningful computation per frame, and ensuring the rendering loop maintains a responsive frame rate within the ESP32's processing headroom will likely require optimising the lookup table access pattern and minimising redundant memory operations. Every stage of the pipeline has knock-on effects on the others, so getting the balance right between rendering quality and throughput will be an iterative process once bench testing begins.",
    takeaways:
      "Even before the layout is finished, this project has already been a valuable exercise in making architecture decisions under uncertainty. Because the scope continues to evolve and the mechanical enclosure is still being defined, every choice at the processor, sensor, and schematic level has had to balance immediate functionality against long-term flexibility. That constraint has forced a more disciplined approach to system design than a project with a fixed specification would require.\n\nThe most significant lesson so far has been the importance of mapping the full data path end-to-end at the schematic stage before committing to layout. Working through the complete signal flow from sensor readout through interpolation, colour mapping, and display output on paper first made it possible to identify potential bottlenecks and routing constraints before they became physical problems on the board. That upfront planning is now directly informing the placement and routing decisions as the layout takes shape.",
  },
  {
    id: 3,
    slug: "aux-control-board",
    organizationId: "paradigm-engineering",
    title: "Aux Control Board",
    category: "PCB Design",
    status: "completed",
    featured: true,
    cardImg: `${assetBase}/media/projects/aux-control-board-card.png`,
    bannerImg: `${assetBase}/media/projects/aux-control-board-banner.png`,
    hoverImg: `${assetBase}/media/projects/aux-control-board-schematic-hover.png`,
    cardBackground: "#000f28",
    hoverPreviewWidth: 980,
    hoverPreviewHeight: 620,
    hoverMediaHeight: 400,
    hoverBackground: "#f5f4ef",
    modalContain: true,
    modalScale: 0.92,
    modalBackground: "#000f28",
    description:
      "A custom auxiliary control board for Paradigm Engineering's autonomous kart, managing power distribution and signal routing across subsystems.",
    tags: ["LDO Voltage Regulator", "Level Shifter", "STM32", "USB to UART"],
    viewer3d: true,
    viewerMode: "bundle",
    viewerAsset: "control",
    designDecisions:
      "This board was designed as a complete second revision, with the goal of optimising and improving every aspect of the original design. When the team decided to split the original single massive board into two separate boards, several components including the steering controller and the 3.3V to 5V level shifting were moved onto this control board to evenly distribute the electrical sections across both boards. Having a clean slate for this revision gave us the opportunity to rethink layout and component selection from scratch rather than patching what we had before.\n\nLDO selection was driven by noise performance rather than efficiency. Several of the connected sensors were sensitive to supply ripple, and at the current levels involved the efficiency penalty of an LDO over a switching regulator was acceptable for the benefit of cleaner output rails. Each regulator was sized with margin above its worst-case load to stay well clear of dropout under the transient current spikes that embedded systems generate during communication bursts and GPIO switching. Logic-level translation between the STM32 microcontroller and peripheral devices running at 5V was handled with bidirectional level shifters placed as close as practical to their respective connectors to minimise stub length on the translated lines. Ground plane strategy was deliberate from the start: separate analog and digital planes tied at a single point near the primary power input, keeping return paths short and predictable and preventing switching noise from coupling into the sensor lines.",
    challenges:
      "The biggest challenge came when the decision to move components from the power board landed while the control board was already in its final stages of development. That forced a hard choice with only two days to decide: either redo the entire board from scratch for the most optimal layout and functional integration, or keep the existing proven design and find a way to accommodate the steering controller and 3.3V to 5V level shifter within the current layout. We chose to stick with the original design because we were confident in its functionality, and analysis showed that including the new components would only increase the length of the board by roughly 15mm.\n\nRouting the additional power rails and signal lines into a layout that was never originally planned around them required careful attention to noise isolation between the analog and digital domains. The added voltage regulators introduced new thermal sources that competed for copper pour real estate on a board that was already well packed, and ensuring adequate thermal relief without compromising signal integrity on adjacent traces required multiple layout iterations in a compressed timeframe. The experience reinforced the value of designing with growth in mind, even when a board's scope feels well-defined at the start.",
    takeaways:
      "Compared to the first revision, the new control board achieved a smaller overall footprint with better noise performance, shorter trace lengths, and tighter layout optimisation, all while incorporating the additional steering controller and level shifting features that the original board never had. Running multiple logic-level devices cleanly from a single regulated supply simplified the broader electrical architecture and gave the rest of the team a reliable foundation to build against during system integration. The board is now in its final testing phase ahead of the Paradigm AKS competition in May 2026.\n\nMore than anything, this project reinforced how much of a board's final performance is determined at the schematic level before layout even begins. The time invested in decisions around noise margins, dropout headroom, regulator sizing, and ground plane topology is what gave us the confidence to absorb a late scope change and still move into final testing without needing another revision. It also demonstrated the importance of designing modular, well-documented subsystems that can accommodate changes without requiring a complete redesign.",
  },
  {
    id: 5,
    slug: "aux-power-board",
    organizationId: "paradigm-engineering",
    title: "Aux Power Board",
    category: "Power Electronics",
    status: "completed",
    featured: true,
    cardImg: `${assetBase}/media/projects/aux-power-board-card.png`,
    bannerImg: `${assetBase}/media/projects/aux-power-board-banner.png`,
    hoverImg: `${assetBase}/media/projects/aux-power-board-schematic-hover.png`,
    cardBackground: "#000f28",
    hoverPreviewWidth: 980,
    hoverPreviewHeight: 620,
    hoverMediaHeight: 400,
    hoverBackground: "#f5f4ef",
    modalContain: true,
    modalScale: 0.92,
    modalImgPosition: "center 47%",
    modalBackground: "#000f28",
    description:
      "A compact power regulation and distribution PCB for Paradigm Engineering's autonomous kart, responsible for conditioning and distributing battery power to all vehicle subsystems.",
    tags: ["48-12V Buck Converters", "Hotswap Battery Circuit", "Remote E-Stop"],
    viewer3d: true,
    viewerMode: "bundle",
    viewerAsset: "power",
    designDecisions:
      "This board came out of a complete overhaul after our previous power board revision turned out to be non-functional during testing. That failure prompted a full review of the electrical architecture, and the team decided to split the original single board into two: a dedicated power board and a separate control board. Components like the steering controller and the 3.3V to 5V level shifting were moved off to the control board, which freed up space and allowed this revision to focus entirely on clean power regulation and distribution.\n\nOne of the most significant findings during the review was that the original board carried a 48V to 24V buck converter and a 24V to 12V buck converter, but very few components actually required the 24V rail. Removing those two converters eliminated an unnecessary intermediate conversion stage, simplified the power path considerably, and opened up enough board real estate to fit the remote e-stop circuitry that had previously been difficult to accommodate. Overcurrent protection was implemented per output rail using resettable polyfuses rather than a single fuse at the input, ensuring that a fault in one subsystem would trip its own protection without interrupting power to the rest of the vehicle. Trace widths were calculated from IPC-2221 guidelines based on each rail's maximum sustained current and then increased further to account for the thermal demands of continuous operation at race conditions.",
    challenges:
      "The failure of the initial revision came down to the buck converter IC manufactured by OnSemi. The component's library footprint had incorrect pad designators on two of its pins, which caused us to inadvertently short the low-side gate pin of the MOSFET to an adjacent net. That short rendered the entire converter non-functional. Making matters worse, the affected trace ran directly underneath the IC package, so within the timeframe we had there was no practical way to desolder the chip, rework the trace, and resolder a replacement. Because the error originated inside the manufacturer's own footprint rather than in our schematic or layout, the DRC checker had no way to flag it, and the issue only surfaced during bench testing when the board failed to regulate.\n\nThat experience fundamentally shaped how we approached the second revision. Every footprint in the library was manually verified against its datasheet pin-for-pin before placement, and we introduced additional peer review steps into the design process that specifically targeted the gap between what automated DRC can catch and what it cannot. It was a difficult lesson in never taking manufacturer-provided assets at face value, and it reinforced how critical it is to prototype and validate early rather than assume that a clean DRC report means a board is ready for fabrication.",
    takeaways:
      "The revised power board brought a level of delivery reliability that the previous approach could not achieve. Subsystems that had previously browned out under peak load now draw cleanly from regulated rails, and the per-rail overcurrent protection has given the team confidence during testing that a fault in one area will not cascade across the vehicle. The board is now in its final testing phase ahead of the Paradigm AKS competition in May 2026.\n\nMore broadly, the entire arc of this project, from the initial failure caused by a manufacturer footprint error through the full architectural review, the board split, and the redesigned second revision, was one of the most formative engineering experiences I have had. It demonstrated that robust power delivery is not just about choosing the right topology and components; it requires a verification process that accounts for every assumption in the design chain, including the ones that come from sources you would normally trust without question. That mindset now carries into every board I work on.",
  },
  {
    id: 6,
    slug: "brick-buck-board",
    organizationId: "paradigm-engineering",
    title: "Brick Buck Board",
    category: "Power Electronics",
    status: "completed",
    featured: true,
    cardImg: `${assetBase}/media/projects/brick-buck-board-card.jpg`,
    bannerImg: `${assetBase}/media/projects/brick-buck-board-layout-hero.png`,
    hoverImg: `${assetBase}/media/projects/brick-buck-board-schematic.png`,
    cardBackground: "#000f28",
    hoverBackground: "#f5f4ef",
    modalContain: true,
    modalBackground: "#000f28",
    viewer3d: true,
    viewerMode: "bundle",
    viewerAsset: "brick",
    bomUrl: `${assetBase}/bom/brick-buck/IBOM.html`,
    description:
      "A backup competition power board for Paradigm Engineering that replaces the custom 48V to 12V stage with a premade Mornsun DC-DC brick while keeping a custom on-board 12V to 5V buck for the lower-voltage electronics.",
    tags: ["12-5V Buck Converter", "48-12V Brick Buck Converters", "Circuit Protection"],
    designDecisions:
      "This board was designed as a contingency plan for competition rather than as the team's primary power architecture. After working through the failure and redesign cycle on the earlier aux power board, we wanted a path to swap in a known-good fallback if the latest revision showed issues late in testing. The central design choice was to stop re-solving the full 48V to 12V conversion stage on this backup board and instead use a premade Mornsun brick converter for that rail, then keep the 12V to 5V stage on-board where I could still control layout, component selection, and validation directly.\n\nThat split kept the board pragmatic. The premade brick removed a large portion of the high-risk power-stage design effort from the backup path, while the on-board 12V to 5V buck still let us tailor the low-voltage rail around the actual subsystem loads and connector arrangement on the kart. Layout decisions were then driven by serviceability and swap-readiness: connectors stayed aligned to the existing subsystem harness expectations, the board kept clear labelling for rapid replacement, and the power path was arranged so this board could slot into the vehicle without the rest of the electrical stack needing a redesign.",
    challenges:
      "The hardest part of the project was not the buck design itself, but sourcing a converter that was efficient enough to justify on-vehicle use without pushing cost beyond what made sense for a backup board. We wanted a premade 48V to 12V solution comfortably above the 94% efficiency range, but the set of parts that met that target narrowed quickly once price and lead time were considered. The module we settled on was originally manufactured by Mornsun, but availability through our supplier had already become limited because of U.S. sanctions affecting the product line. That meant we were making a design decision around a part that was effectively living on borrowed time from a supply perspective.\n\nBecause this board was only intended as a fallback for competition, that tradeoff was still acceptable, but it changed how the whole design had to be thought about. Instead of chasing the most elegant long-term architecture, the focus became short-term robustness: use the limited-stock brick where it reduced risk the most, keep the custom circuitry to the 12V to 5V stage that I could validate directly, and make sure the finished board was documented clearly enough that the team could deploy it quickly if the primary power board ever had to come out of the kart.",
    takeaways:
      "This project reinforced that there is a real engineering difference between a primary design and a contingency design. The right answer for a backup board is not always the most custom or technically ambitious solution; it is the one that reduces failure modes, can be validated quickly, and gives the team a realistic path to keep moving under competition pressure. In that context, pairing a premade high-efficiency brick with a custom downstream buck was the right balance between control and pragmatism.\n\nIt also sharpened how I think about supply-chain risk as part of hardware design rather than as a separate procurement problem. A part can be electrically perfect and still be the wrong choice if its availability makes the design brittle. In this case the limited-stock Mornsun module was acceptable only because the board was intentionally scoped as a backup. That distinction matters, and working through it made the design process more disciplined than simply choosing components on electrical performance alone.",
  },
  {
    id: 2,
    slug: "digital-table-tennis-umpire",
    organizationId: "personal-lab",
    title: "Digital Table Tennis Umpire",
    category: "Python",
    status: "completed",
    featured: false,
    description:
      "An automated line-judge system for table tennis that uses vibration sensors and real-time signal processing to detect ball impact location and call in or out decisions.",
    tags: ["Arduino", "Sensors", "Python", "LCD", "Real-Time"],
    github: "https://github.com",
    challenges:
      "High-speed ball impacts and environmental table vibration look remarkably similar to a sensor, and tuning the detection threshold was an iterative process of physical testing across ball types, strike intensities, and edge cases. False positives were the persistent enemy, and eliminating them without making the system under-sensitive required careful filtering logic. On the firmware side, the event pipeline had to be interrupt-driven and tightly synchronised to ensure the LCD update never lagged behind the call.",
    takeaways:
      "The system called line and net serve decisions accurately across all test scenarios, removing the subjectivity that usually makes line judging contentious. At the university engineering showcase it placed 3rd out of over 60 competing projects in the Verafin-hosted competition, recognised for both the technical depth of the implementation and its relevance to a real-world officiating problem.",
  },
  {
    id: 4,
    slug: "dji-m600-sensor-mount",
    organizationId: "memorial-coursework",
    title: "DJI M600 Sensor Mount",
    category: "PCB Design",
    status: "",
    featured: false,
    cardImg: `${assetBase}/media/projects/dji-m600-sensor-mount-card.jpg`,
    bannerImg: `${assetBase}/media/projects/dji-m600-sensor-mount-banner.jpg`,
    reportAsset: documents.engineeringReport,
    reportPages,
    description:
      "A custom payload mounting system designed for the DJI M600 hexacopter, pairing a mechanical mount with a purpose-built interface PCB to integrate multiple survey sensors with the flight controller over CAN bus.",
    tags: ["KiCad", "CAN Bus", "DJI M600", "PCB", "Sensors"],
    github: "https://github.com",
    challenges:
      "The DJI M600's payload budget left little room for error, and every gram of mount and PCB had to be justified. Maintaining signal integrity on CAN bus traces while the airframe vibrates continuously took deliberate layout choices around termination and trace routing. Power delivery to the sensors was similarly tricky: connectors and strain relief needed to handle the constant mechanical stress of flight without introducing voltage glitches. Keeping analog sensor lines away from broadband EMI from six brushless motors and their ESCs was the final puzzle piece.",
    takeaways:
      "The finished system gave the M600 a clean, purpose-built sensor payload capability that slotted into the existing avionics stack without modification. It met the weight budget, survived the vibration environment of extended flight operations, and delivered reliable data across surveying missions, turning a general-purpose drone platform into a capable tool for environmental and remote sensing work.",
  },
];

export const organizations: OrganizationRecord[] = [
  {
    id: "paradigm-engineering",
    name: "Paradigm Engineering",
    kind: "team",
    role: "Electrical Team",
    period: "Jan 2026 — Present",
    cardSummary:
      "Autonomous kart design team work spanning power distribution, control hardware, board bring-up, and system integration.",
    overview: [
      "Paradigm Engineering is Memorial University's autonomous kart design team. My work there has focused on the electrical stack, translating subsystem requirements into production-ready PCB revisions, cleaner power architecture, and board-level validation before full vehicle integration.",
      "The work has been iterative rather than one-off: re-architecting the failed first revision into split power/control boards, tightening noise margins and interface design, and then carrying those boards into bring-up and integration testing ahead of competition deadlines.",
    ],
    tags: ["STM32", "KiCad", "Embedded C", "PCB Design", "FDCAN", "Power Electronics"],
    logo: `${assetBase}/media/experience/paradigm-logo.png`,
    builds: [
      {
        id: "paradigm-power-board",
        title: "Aux Power Board Re-Architecture",
        period: "Jan 2026",
        summary:
          "Reworked Paradigm's power architecture after the original revision failed bench testing, splitting the electrical stack into a dedicated power board and a separate control board.",
        bullets: [
          "Removed the unnecessary 24V intermediate rail and simplified the supply path into cleaner 48V, 12V, 5V, and 3.3V distribution.",
          "Added per-rail overcurrent protection and carved out board area for the remote e-stop circuitry that the earlier revision struggled to accommodate.",
          "Manually re-verified all critical library footprints against datasheets after the first revision failed because of a manufacturer footprint error.",
        ],
        tags: ["Buck Conversion", "Protection", "Remote E-Stop", "IPC-2221"],
        media: `${assetBase}/media/projects/aux-power-board-banner.png`,
        mediaBackground: "#000f28",
        projectSlug: "aux-power-board",
      },
      {
        id: "paradigm-control-board",
        title: "Aux Control Board Revision",
        period: "Feb 2026 — Mar 2026",
        summary:
          "Built the second-revision control board around cleaner regulated rails, logic-level translation, and a tighter overall footprint for the kart's control hardware.",
        bullets: [
          "Selected quieter LDO rails for sensitive devices and integrated bidirectional 3.3V to 5V level shifting close to the relevant connectors.",
          "Adapted the layout to absorb late scope changes, including steering-controller related circuitry, without restarting the design from scratch.",
          "Used ground-plane planning, trace-length cleanup, and tighter placement to improve noise behavior over the earlier revision.",
        ],
        tags: ["LDOs", "Level Shifters", "Noise Management", "Subsystem Integration"],
        media: `${assetBase}/media/projects/aux-control-board-banner.png`,
        mediaBackground: "#000f28",
        projectSlug: "aux-control-board",
      },
      {
        id: "paradigm-brick-buck",
        title: "Brick Buck Backup Board",
        period: "Apr 2026",
        summary:
          "Designed a backup competition power board that uses a premade Mornsun 48V to 12V brick and a custom on-board 12V to 5V buck so the team can swap hardware quickly if the primary aux power board shows issues.",
        bullets: [
          "Moved the highest-risk conversion stage to a premade brick converter while keeping the 12V to 5V section custom so the low-voltage rail could still be laid out and validated around our actual subsystem loads.",
          "Kept the connector strategy and power-distribution intent aligned with the existing kart wiring so the board could serve as a realistic competition fallback rather than an isolated lab prototype.",
          "Worked through the sourcing constraint of a limited-stock Mornsun module and accepted that tradeoff only because this board was intentionally scoped as a backup, not the long-term production path.",
        ],
        tags: ["Backup Strategy", "Mornsun Brick", "12V to 5V Buck", "Competition Prep"],
        media: `${assetBase}/media/projects/brick-buck-board-layout.png`,
        mediaBackground: "#000f28",
        mediaContain: true,
        projectSlug: "brick-buck-board",
      },
      {
        id: "paradigm-validation",
        title: "Bring-Up & Integration Testing",
        period: "Mar 2026 — Present",
        summary:
          "Moved both board revisions into validation and team integration work, closing the loop between design decisions on paper and behavior on the bench.",
        bullets: [
          "Bench-checked rails, interfaces, and protection behavior to confirm the revised board split held up under subsystem load.",
          "Worked through signal-integrity and layout-driven issues before the boards were pushed into wider vehicle integration.",
          "Documented findings and design updates so the rest of the electrical team could build on a stable hardware baseline going into competition prep.",
        ],
        tags: ["Validation", "Bring-Up", "Oscilloscope", "Documentation"],
        media: `${assetBase}/media/projects/aux-control-board-card.png`,
        mediaBackground: "#000f28",
        mediaContain: true,
      },
    ],
  },
  {
    id: "personal-lab",
    name: "Personal Lab",
    kind: "personal",
    role: "Independent Builds",
    period: "2025 — Present",
    cardSummary:
      "Self-directed embedded and instrumentation projects scoped, prototyped, debugged, and documented independently.",
    overview: [
      "My personal projects are where I can iterate quickly on ideas without course or team constraints. They usually start from a specific hardware or sensing problem and become a full-stack exercise in architecture, firmware tradeoffs, debugging, and documentation.",
      "They also give me room to follow curiosity: one project grew out of competitive table tennis and signal detection, while another is about building a handheld thermal instrument from the sensor pipeline outward.",
    ],
    tags: ["ESP32", "Sensors", "Python", "Embedded Systems", "Rapid Prototyping"],
    monogram: "CL",
    builds: [
      {
        id: "personal-umpire",
        title: "Digital Table Tennis Umpire",
        period: "2025",
        summary:
          "Built an automated line-judge system that uses vibration sensing and real-time processing to call in-or-out table tennis shots with less subjectivity than manual judging.",
        bullets: [
          "Tuned the sensing and detection thresholds against real impact patterns so false positives from table vibration did not overwhelm actual events.",
          "Structured the firmware and event handling to keep LCD feedback responsive while maintaining reliable signal classification.",
          "Presented the system at the university engineering showcase, where it placed 3rd in the Verafin-hosted competition.",
        ],
        tags: ["Arduino", "Sensors", "Python", "LCD", "Real-Time"],
        projectSlug: "digital-table-tennis-umpire",
      },
      {
        id: "personal-thermal-camera",
        title: "Handheld Thermal Camera",
        period: "2026 — Present",
        summary:
          "Designing a handheld thermal imager around an ESP32 and AMG8833 sensor array, with the current focus on completing layout and validating the embedded rendering pipeline.",
        bullets: [
          "Mapped the full data path from sensor acquisition through bicubic interpolation, color mapping, and display output before committing to layout.",
          "Chose a compact single-cell architecture and 3.3V rail to keep the hardware portable while still supporting the display and sensing pipeline cleanly.",
          "Using the layout phase to work through routing, thermal separation, and practical enclosure constraints before hardware bring-up.",
        ],
        tags: ["ESP32", "AMG8833", "Display Pipeline", "PCB Layout"],
        media: `${assetBase}/media/projects/thermal-camera-schematic-card.png`,
        mediaBackground: "#f5f4ef",
        mediaContain: true,
        projectSlug: "thermal-camera",
      },
    ],
  },
  {
    id: "memorial-coursework",
    name: "Memorial University",
    kind: "coursework",
    role: "Coursework & Design Reporting",
    period: "2024 — Present",
    cardSummary:
      "Course-driven engineering work focused on documented design process, integration constraints, and presentation-ready deliverables.",
    overview: [
      "Coursework projects are where I turn class requirements into something that still feels like real engineering work: constrained by documentation, deadlines, and formal review, but still judged by whether the design decisions actually hold up.",
      "That has been useful for learning how to communicate hardware choices clearly, build around external constraints, and package technical work into something a reviewer can follow from concept to final deliverable.",
    ],
    tags: ["Documentation", "KiCad", "CAN Bus", "System Integration", "Design Reporting"],
    monogram: "MU",
    builds: [
      {
        id: "coursework-dji",
        title: "DJI M600 Sensor Mount",
        period: "2025",
        summary:
          "Developed a custom payload mounting system for the DJI M600 that paired a mechanical mount with a purpose-built interface PCB for sensor integration.",
        bullets: [
          "Balanced the payload budget against electrical and mechanical requirements so the assembly could survive vibration without blowing the weight target.",
          "Planned CAN bus routing and connector behavior around signal integrity and the constant vibration environment of the airframe.",
          "Delivered the design as a documented engineering report, packaging both the hardware decisions and the integration tradeoffs into a reviewable course deliverable.",
        ],
        tags: ["KiCad", "CAN Bus", "DJI M600", "Sensors"],
        media: `${assetBase}/media/projects/dji-m600-sensor-mount-banner.jpg`,
        mediaBackground: "#000f28",
        projectSlug: "dji-m600-sensor-mount",
      },
    ],
  },
];

export const organizationsById = Object.fromEntries(
  organizations.map((organization) => [organization.id, organization]),
) as Record<string, OrganizationRecord>;

export function getOrganizationById(organizationId: string) {
  return organizationsById[organizationId] ?? null;
}

export function getProjectBySlug(projectSlug: string) {
  return projects.find((project) => project.slug === projectSlug) ?? null;
}

export const featuredBoardProjects = projects.filter((project) => project.featured && project.viewer3d);
export const featuredProject = featuredBoardProjects[0] ?? projects[0];
