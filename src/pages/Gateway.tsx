import { Link } from 'react-router-dom';
import { ArrowRight, Cpu, Landmark } from 'lucide-react';
import logo from '@/assets/namsan-logo-gold.png';
import namsanTowerBg from '@/assets/namsan-tower-night.jpg';

const cards = [
  {
    to: '/ai',
    icon: Cpu,
    title: 'Namsan AI Group',
    desc: 'End-to-end GPU cloud and AI infrastructure for training, inference and HPC workloads.',
  },
  {
    to: '/family-office',
    icon: Landmark,
    title: 'Namsan Family Office',
    desc: 'Wealth management services built on trust, expertise and enduring partnerships.',
  },
];

export default function Gateway() {
  return (
    <div className="relative min-h-screen flex flex-col">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${namsanTowerBg})` }} />
      <div className="absolute inset-0 bg-primary/80" />
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-16">
        <img src={logo} alt="Namsan Partners" className="h-14 sm:h-20 mb-6 object-contain" />
        <h1 className="gateway-brand-title text-3xl sm:text-5xl font-light text-center mb-3">Namsan Partners</h1>
        <p className="text-primary-foreground/70 text-center mb-12 max-w-xl">Choose a division to continue.</p>
        <div className="grid gap-6 sm:grid-cols-2 w-full max-w-4xl">
          {cards.map(({ to, icon: Icon, title, desc }) => (
            <Link
              key={to}
              to={to}
              className="group rounded-xl border border-primary-foreground/20 bg-background/10 backdrop-blur-md p-8 transition hover:bg-background/20 hover:border-accent"
            >
              <Icon className="h-10 w-10 text-accent mb-6" />
              <h2 className="text-2xl font-medium text-primary-foreground mb-3">{title}</h2>
              <p className="text-primary-foreground/70 mb-6">{desc}</p>
              <span className="inline-flex items-center gap-2 text-accent font-medium">
                Enter <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </div>
      <footer className="relative z-10 text-center text-primary-foreground/50 text-xs py-6">
        © {new Date().getFullYear()} Namsan Partners. All rights reserved.
      </footer>
    </div>
  );
}
