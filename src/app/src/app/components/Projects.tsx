import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Github, ExternalLink, Cpu, Sun, Battery, Radio, Gauge, CircuitBoard } from "lucide-react";

const projects = [
  {
    title: "Solar MPPT Charge Controller",
    icon: Sun,
    description:
      "Designed a Perturb & Observe MPPT controller with an STM32 and synchronous buck converter reaching 96% peak efficiency.",
    tags: ["Power Electronics", "STM32", "PCB"],
  },
  {
    title: "Smart Home Energy Monitor",
    icon: Gauge,
    description:
      "IoT energy meter with ESP32, current transformers, and a React dashboard for real-time per-circuit consumption.",
    tags: ["ESP32", "React", "MQTT"],
  },
  {
    title: "BLDC Motor Controller",
    icon: Cpu,
    description:
      "Field-oriented control for a sensorless BLDC motor using an STM32G4 and custom 3-phase inverter PCB.",
    tags: ["FOC", "Embedded C", "Motor Control"],
  },
  {
    title: "Grid-Tied Inverter Sim",
    icon: CircuitBoard,
    description:
      "MATLAB/Simulink model of a single-phase grid-tied inverter with PLL synchronization and anti-islanding protection.",
    tags: ["MATLAB", "Simulink", "Grid"],
  },
  {
    title: "Li-ion Battery BMS",
    icon: Battery,
    description:
      "4S battery management system with passive cell balancing, coulomb counting, and UART telemetry.",
    tags: ["BMS", "Analog", "Firmware"],
  },
  {
    title: "LoRa Weather Station",
    icon: Radio,
    description:
      "Solar-powered remote sensor node sending temperature, humidity, and irradiance data over LoRa to a base station.",
    tags: ["LoRa", "Low-power", "Sensors"],
  },
];

export function Projects() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8faf9" }}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Hardware, firmware, and simulation projects built during coursework and free time.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((p) => {
            const Icon = p.icon;
            return (
              <Card
                key={p.title}
                className="p-6 hover:shadow-xl transition-all hover:-translate-y-1 bg-gradient-to-br from-card to-primary/5 border-primary/10 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                    <Icon className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div className="flex gap-2 text-muted-foreground">
                    <Github className="w-4 h-4 hover:text-primary cursor-pointer" />
                    <ExternalLink className="w-4 h-4 hover:text-primary cursor-pointer" />
                  </div>
                </div>
                <h3 className="mb-2">{p.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{p.description}</p>
                <div className="flex flex-wrap gap-2">
                  {p.tags.map((t) => (
                    <Badge
                      key={t}
                      className="bg-primary/10 text-primary border-primary/20 text-xs"
                    >
                      {t}
                    </Badge>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
