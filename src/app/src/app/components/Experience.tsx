import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Briefcase, Calendar, MapPin } from "lucide-react";

const experiences = [
  {
    role: "Electrical Engineering Intern",
    company: "Siemens Energy",
    location: "Manchester, UK",
    period: "Jun 2025 – Sep 2025",
    description:
      "Supported the power systems team in testing medium-voltage switchgear. Built a Python tool to automate load-flow report generation, cutting analysis time by 40%.",
    tags: ["Power Systems", "Python", "MATLAB", "Testing"],
  },
  {
    role: "Research Assistant",
    company: "University Power Electronics Lab",
    location: "On-campus",
    period: "Jan 2025 – May 2025",
    description:
      "Designed and prototyped a bidirectional DC-DC converter for solar storage applications. Co-authored a conference paper on efficiency improvements.",
    tags: ["DC-DC Converter", "PCB Design", "LTspice", "Research"],
  },
  {
    role: "Embedded Systems Intern",
    company: "Nexus Robotics",
    location: "Remote",
    period: "Jun 2024 – Aug 2024",
    description:
      "Developed firmware for an STM32-based motor controller. Implemented CAN bus communication and PID speed regulation for industrial automation prototypes.",
    tags: ["STM32", "C", "CAN Bus", "Firmware"],
  },
  {
    role: "Teaching Assistant — Circuits I",
    company: "University of Manchester",
    location: "On-campus",
    period: "Sep 2023 – May 2024",
    description:
      "Led weekly lab sessions for 30+ students on circuit analysis, oscilloscope use, and breadboard prototyping. Graded assignments and held office hours.",
    tags: ["Teaching", "Circuit Analysis", "Mentoring"],
  },
];

export function Experience() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8faf9" }}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Work Experience</h1>
          <p className="text-muted-foreground mt-1">
            Internships, research, and teaching roles across power systems and embedded tech.
          </p>
        </div>

        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-transparent" />

          <div className="space-y-6">
            {experiences.map((exp, i) => (
              <div key={i} className="relative pl-16">
                <div className="absolute left-2 top-6 w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg ring-4 ring-background">
                  <Briefcase className="w-4 h-4 text-primary-foreground" />
                </div>

                <Card className="p-6 hover:shadow-lg transition-shadow bg-gradient-to-br from-card to-primary/5 border-primary/10">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                    <div>
                      <h3 className="text-lg">{exp.role}</h3>
                      <p className="text-primary">{exp.company}</p>
                    </div>
                    <div className="flex flex-col md:items-end gap-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" /> {exp.period}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4" /> {exp.location}
                      </span>
                    </div>
                  </div>
                  <p className="text-muted-foreground mt-3">{exp.description}</p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {exp.tags.map((t) => (
                      <Badge
                        key={t}
                        className="bg-primary/10 text-primary border-primary/20"
                      >
                        {t}
                      </Badge>
                    ))}
                  </div>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
