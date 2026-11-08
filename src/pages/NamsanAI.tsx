import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Server, Boxes, Cloud, ClipboardCheck, CalendarClock, Wrench, Cpu, ArrowRight } from 'lucide-react';
import logo from '@/assets/namsan-logo.png';
import namsanTowerBg from '@/assets/namsan-tower-night.jpg';

const CONTACT = 'mailto:info@namsan-partners.com?subject=Namsan%20AI%20Inquiry';

const offerings = [
  { icon: Server, title: 'GPU Server Deployment', desc: 'Deploy fully managed, performance-optimized GPU solutions, built to scale and configured for your training, simulation or inference workloads.', cta: 'Request a Server' },
  { icon: Boxes, title: 'Turnkey AI Clusters', desc: 'Quickly deploy scalable, AI-ready GPU clusters with NVIDIA-validated architecture, pre-configured for performance and built for growth.', cta: 'Build Your Cluster' },
  { icon: Cloud, title: 'Reserved GPU Cloud', desc: 'High-performance H100 clusters with guaranteed capacity, instant scalability and bare-metal performance with no virtualization overhead.', cta: 'Access Now' },
];

const steps = [
  { icon: ClipboardCheck, title: 'Assessment & Strategy', desc: 'In-depth consultations to identify optimal GPU configurations and deployment models — cloud, on-premises or hybrid.' },
  { icon: CalendarClock, title: 'Onboarding & Scheduling', desc: 'Fast GPU cluster provisioning and resource coordination, with clear ready times.' },
  { icon: Wrench, title: 'Deployment & Management', desc: 'Seamless installation and ongoing support to keep your GPU infrastructure at peak performance.' },
];

const servers = [
  { title: 'NVIDIA HGX B300 NVL16', desc: 'Build AI factories that train faster and serve smarter with Blackwell Ultra accelerators and fifth-generation NVLink.' },
  { title: 'NVIDIA HGX B200', desc: 'NVIDIA Blackwell GPUs for accelerated AI and HPC workloads with dramatically faster inference and lower energy use.' },
  { title: 'NVIDIA RTX PRO 6000', desc: 'Blackwell-architecture server edition for AI visualization, digital twins and 3D content creation.' },
  { title: 'NVIDIA HGX H200', desc: 'Enhanced memory capacity and bandwidth over H100, ideal for large-scale model training.' },
  { title: 'NVIDIA HGX H100', desc: 'The proven enterprise GPU, delivering performance and scalability for production AI.' },
];

export default function NamsanAI() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="bg-accent text-accent-foreground text-center text-sm py-2 px-4">
        NVIDIA HGX B300 NVL8 servers available now.
      </div>
      <header className="sticky top-0 z-40 bg-primary/95 backdrop-blur border-b border-primary-foreground/10">
        <div className="container mx-auto flex items-center justify-between px-4 h-16">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Namsan AI" className="h-8 object-contain" />
            <span className="text-primary-foreground font-semibold tracking-wide">Namsan AI</span>
          </Link>
          <Button asChild variant="secondary" size="sm"><a href={CONTACT}>Talk to a GPU Expert</a></Button>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${namsanTowerBg})` }} />
        <div className="absolute inset-0 bg-primary/85" />
        <div className="relative container mx-auto px-4 py-28 sm:py-36 text-center">
          <p className="uppercase tracking-[0.3em] text-accent text-xs mb-4">Namsan AI Group</p>
          <h1 className="text-4xl sm:text-6xl font-light text-primary-foreground max-w-4xl mx-auto leading-tight">
            End-to-End GPU Cloud for AI & HPC
          </h1>
          <div className="mt-10 flex justify-center gap-4 flex-wrap">
            <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90"><a href={CONTACT}>Talk to a GPU Expert</a></Button>
            <Button asChild size="lg" variant="outline" className="bg-transparent text-primary-foreground border-primary-foreground/40 hover:bg-primary-foreground/10"><a href="#servers">Explore Servers</a></Button>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <h2 className="text-3xl font-light mb-4">Simplify Your AI & HPC Infrastructure Decisions</h2>
          <p className="text-muted-foreground">
            Namsan AI equips AI and HPC teams with the infrastructure to train faster, scale efficiently and deploy with confidence.
            We deliver custom GPU solutions built for performance, reliability and growth — from planning to deployment and ongoing support.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {offerings.map(({ icon: Icon, title, desc, cta }) => (
            <div key={title} className="rounded-xl border bg-card p-8 flex flex-col">
              <Icon className="h-9 w-9 text-accent mb-5" />
              <h3 className="text-xl font-medium mb-3">{title}</h3>
              <p className="text-muted-foreground flex-1">{desc}</p>
              <a href={CONTACT} className="mt-6 inline-flex items-center gap-2 text-primary font-medium hover:text-accent">{cta} <ArrowRight className="h-4 w-4" /></a>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-20">
          <h2 className="text-3xl font-light text-center mb-12">Our Consultative Approach</h2>
          <div className="grid gap-10 md:grid-cols-2 max-w-5xl mx-auto mb-14">
            <div>
              <h3 className="text-lg font-medium text-accent mb-2">GPU Solutions for Your Unique Workloads</h3>
              <p className="text-primary-foreground/75">We start by understanding your specific AI or HPC objectives, then craft customized GPU infrastructure — short-term capacity for peak demand or dedicated clusters for ongoing training.</p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-accent mb-2">Why This Matters</h3>
              <p className="text-primary-foreground/75">A hands-on, consultative approach gets you the best mix of performance, cost efficiency and scalability — without juggling multiple vendors or misaligned solutions.</p>
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl border border-primary-foreground/15 p-6">
                <Icon className="h-8 w-8 text-accent mb-4" />
                <h4 className="font-medium mb-2">{title}</h4>
                <p className="text-sm text-primary-foreground/70">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="servers" className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-light text-center mb-12">Explore Our High-Performance NVIDIA GPU Servers</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {servers.map(({ title, desc }) => (
            <div key={title} className="rounded-xl border bg-card p-6 flex flex-col">
              <Cpu className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-lg font-medium mb-2">{title} Servers</h3>
              <p className="text-sm text-muted-foreground flex-1">{desc}</p>
              <a href={CONTACT} className="mt-5 inline-flex items-center gap-2 text-primary font-medium hover:text-accent">Explore Configurations <ArrowRight className="h-4 w-4" /></a>
            </div>
          ))}
        </div>
      </section>

      <footer className="bg-primary text-primary-foreground/60 text-center text-xs py-8">
        © {new Date().getFullYear()} Namsan AI Group · A Namsan Partners company · <Link to="/" className="underline hover:text-accent">Home</Link>
      </footer>
    </div>
  );
}
