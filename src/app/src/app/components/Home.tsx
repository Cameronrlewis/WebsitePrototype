import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import {
  Cpu,
  Zap,
  GraduationCap,
  Award,
  MapPin,
  Mail,
  Github,
  Linkedin,
  Sun,
  Sparkles,
  Calendar,
  ArrowRight,
  Box,
  ImageIcon,
} from "lucide-react";

const stats = [
  { label: "Degree", value: "BEng", unit: "EE · Class of 2026", icon: GraduationCap },
  { label: "Projects", value: "12", unit: "completed", icon: Cpu },
  { label: "Internships", value: "2", unit: "companies", icon: Zap },
  { label: "Certifications", value: "6", unit: "earned", icon: Award },
];

export function Home() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8faf9" }}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Hello, I'm Liam Gallagher! 👋
            </h1>
            <p className="text-muted-foreground mt-1">
              Electrical Engineering Student · Aspiring Power Systems Engineer
            </p>
          </div>
          <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1.5">
            <div className="w-2 h-2 bg-primary rounded-full mr-2 animate-pulse"></div>
            Open to internships
          </Badge>
        </div>

        <Card className="p-6 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg flex-shrink-0">
              <span className="text-primary-foreground text-2xl font-semibold">LG</span>
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h2 className="text-xl">About Me</h2>
                <p className="text-muted-foreground mt-2">
                  Final-year Electrical Engineering student passionate about renewable energy,
                  smart grids, and embedded systems. I love turning ideas into working circuits —
                  from tiny microcontroller prototypes to full power-monitoring dashboards.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> Manchester, UK</span>
                <span className="flex items-center gap-1.5"><Mail className="w-4 h-4" /> liam@example.com</span>
                <span className="flex items-center gap-1.5"><Github className="w-4 h-4" /> github.com/liamg</span>
                <span className="flex items-center gap-1.5"><Linkedin className="w-4 h-4" /> linkedin.com/in/liamg</span>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label} className="p-4 bg-gradient-to-br from-card to-primary/5 border-primary/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                    <p className="text-2xl mt-1">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.unit}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="p-8 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border-primary/30 relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-12 w-56 h-56 rounded-full bg-primary/10 blur-3xl" />

          <div className="relative flex flex-wrap items-center gap-2 mb-6">
            <Badge className="bg-primary text-primary-foreground border-0 px-3 py-1">
              <Sparkles className="w-3 h-3 mr-1.5" /> Newest Project
            </Badge>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" /> Added April 2026
            </span>
          </div>

          <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <button
              type="button"
              className="group relative aspect-video w-full rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border-2 border-dashed border-primary/30 flex flex-col items-center justify-center gap-3 hover:border-primary/60 hover:from-primary/30 transition-all overflow-hidden"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Box className="w-8 h-8 text-primary-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm">Click to view 3D model</p>
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5 mt-1">
                  <ImageIcon className="w-3 h-3" />
                  or drop an image here
                </p>
              </div>
            </button>

            <div className="min-w-0">
              <div className="flex items-start gap-3">
                <Sun className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h2 className="text-2xl">Solar MPPT Charge Controller</h2>
                  <p className="text-muted-foreground mt-3 leading-relaxed">
                    Just wrapped up a Perturb & Observe MPPT controller built around an STM32 and
                    a synchronous buck converter — hit 96% peak efficiency on the bench. Currently
                    tidying up the KiCad layout and writing a build log.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-5 ml-9">
                <Badge className="bg-primary/10 text-primary border-primary/20">STM32</Badge>
                <Badge className="bg-primary/10 text-primary border-primary/20">Power Electronics</Badge>
                <Badge className="bg-primary/10 text-primary border-primary/20">KiCad</Badge>
              </div>

              <Button size="lg" className="mt-6 ml-9 bg-gradient-to-br from-primary to-primary/80 shadow-lg">
                View Full Project <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
