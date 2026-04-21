import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Mail, Github, Linkedin, MapPin, Phone, Send, Download } from "lucide-react";

export function Contact() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8faf9" }}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Contact & Profile</h1>
          <p className="text-muted-foreground mt-1">
            Let's talk internships, collaborations, or just circuits over coffee.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 p-6 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
                <span className="text-primary-foreground text-2xl font-semibold">LG</span>
              </div>
              <h3 className="mt-4">Liam Gallagher</h3>
              <p className="text-sm text-muted-foreground">EE Student · Class of 2026</p>

              <div className="w-full mt-6 space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mail className="w-4 h-4 text-primary" />
                  </div>
                  <span>liam@example.com</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Phone className="w-4 h-4 text-primary" />
                  </div>
                  <span>+44 7700 900123</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-primary" />
                  </div>
                  <span>Manchester, UK</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Github className="w-4 h-4 text-primary" />
                  </div>
                  <span>github.com/liamg</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Linkedin className="w-4 h-4 text-primary" />
                  </div>
                  <span>linkedin.com/in/liamg</span>
                </div>
              </div>

              <Button className="w-full mt-6 bg-gradient-to-br from-primary to-primary/80">
                <Download className="w-4 h-4 mr-2" /> Download Resume
              </Button>
            </div>
          </Card>

          <Card className="lg:col-span-2 p-6">
            <h3 className="mb-4">Send a message</h3>
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Your name</Label>
                  <Input id="name" placeholder="Jane Doe" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="jane@company.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" placeholder="Internship opportunity at..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  rows={6}
                  placeholder="Tell me about the role, project, or idea..."
                />
              </div>
              <Button
                type="submit"
                className="bg-gradient-to-br from-primary to-primary/80"
              >
                <Send className="w-4 h-4 mr-2" /> Send Message
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
