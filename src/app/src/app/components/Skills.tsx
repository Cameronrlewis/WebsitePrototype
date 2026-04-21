import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  CircuitBoard,
  Cpu,
  Waves,
  Code2,
  Wrench,
  Sparkles,
  BookOpen,
} from "lucide-react";

const domains = [
  {
    title: "Hardware & Circuits",
    icon: CircuitBoard,
    blurb:
      "Where I feel most at home — prototyping analog/mixed-signal circuits, reading datasheets, and taking boards from schematic to working hardware.",
    tools: ["KiCad", "Altium", "LTspice", "Oscilloscopes", "Logic Analyzers", "Soldering"],
    highlight: "Designed a 4-layer PCB for a 96%-efficient MPPT converter.",
  },
  {
    title: "Embedded & Firmware",
    icon: Cpu,
    blurb:
      "Writing the code that makes the hardware do things — from bare-metal peripheral drivers to real-time motor control loops.",
    tools: ["Embedded C", "C++", "STM32", "ESP32", "FreeRTOS", "CAN", "I²C", "SPI", "UART"],
    highlight: "Shipped production firmware for an industrial BLDC motor controller.",
  },
  {
    title: "Power & Control Systems",
    icon: Waves,
    blurb:
      "The theory side I love — power electronics, control loops, and understanding why a system behaves the way it does on a scope.",
    tools: ["MATLAB", "Simulink", "PLECS", "Control Theory", "Power Electronics", "Grid Systems"],
    highlight: "Co-authored a paper on bidirectional DC-DC converter efficiency.",
  },
  {
    title: "Software & Scripting",
    icon: Code2,
    blurb:
      "Glue code, data analysis, and the occasional web dashboard — I write whatever I need to make a project feel finished.",
    tools: ["Python", "NumPy", "Pandas", "React", "TypeScript", "Git", "Linux"],
    highlight: "Built a React dashboard visualizing live IoT energy data over MQTT.",
  },
];

const learning = [
  "GaN-based power converter design",
  "Digital signal processing with TI C2000",
  "RF fundamentals & PCB layout for high-speed",
];

const approaches = [
  {
    icon: Wrench,
    title: "I like to build before I theorize",
    detail:
      "Breadboard first, optimize later. Seeing something work on the bench keeps the theory honest.",
  },
  {
    icon: BookOpen,
    title: "I read the datasheet",
    detail:
      "Half the bugs I've fixed were already in the app-note. I take notes, cross-reference, and ask questions.",
  },
  {
    icon: Sparkles,
    title: "I care about the finish",
    detail:
      "Silkscreen alignment, wire dressing, a clean enclosure — the details that turn a prototype into a project.",
  },
];

export function Skills() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8faf9" }}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Skills & Toolbox</h1>
          <p className="text-muted-foreground mt-1">
            The areas I work in, the tools I reach for, and how I like to approach a problem.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {domains.map((d) => {
            const Icon = d.icon;
            return (
              <Card
                key={d.title}
                className="p-6 bg-gradient-to-br from-card to-primary/5 border-primary/10 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md flex-shrink-0">
                    <Icon className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3>{d.title}</h3>
                    <p className="text-sm text-muted-foreground mt-2">{d.blurb}</p>

                    <div className="flex flex-wrap gap-1.5 mt-4">
                      {d.tools.map((t) => (
                        <Badge
                          key={t}
                          className="bg-primary/10 text-primary border-primary/20"
                        >
                          {t}
                        </Badge>
                      ))}
                    </div>

                    <div className="mt-4 pt-4 border-t border-primary/10 flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground italic">
                        {d.highlight}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="p-6 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-primary" />
            <h3>Currently Learning</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Things I'm digging into right now — because there's always a next thing.
          </p>
          <div className="flex flex-wrap gap-2">
            {learning.map((l) => (
              <div
                key={l}
                className="px-4 py-2 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-sm shadow-md"
              >
                {l}
              </div>
            ))}
          </div>
        </Card>

        <div>
          <h3 className="mb-4">How I Work</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {approaches.map((a) => {
              const Icon = a.icon;
              return (
                <Card key={a.title} className="p-5 bg-gradient-to-br from-card to-primary/5 border-primary/10">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-sm">{a.title}</p>
                  <p className="text-xs text-muted-foreground mt-2">{a.detail}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
