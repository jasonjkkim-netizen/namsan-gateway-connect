import { useEffect, useState, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface StatItem {
  value: number;
  suffix: string;
  labelKo: string;
  labelEn: string;
}

const stats: StatItem[] = [
  { value: 15, suffix: '+', labelKo: '투자 경력 (년)', labelEn: 'Years of Experience' },
  { value: 500, suffix: '+', labelKo: '운용 자산 (억원)', labelEn: 'AUM (₩100M)' },
  { value: 50, suffix: '+', labelKo: '투자 고객', labelEn: 'Clients Served' },
  { value: 98, suffix: '%', labelKo: '고객 만족도', labelEn: 'Client Satisfaction' },
];

function useCountUp(end: number, duration: number = 2000, startCounting: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!startCounting) return;

    let startTime: number | null = null;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration, startCounting]);

  return count;
}

function StatCard({ stat, index, isVisible }: { stat: StatItem; index: number; isVisible: boolean }) {
  const { language } = useLanguage();
  const count = useCountUp(stat.value, 2000, isVisible);

  return (
    <div 
      className="text-center p-8 animate-fade-in"
      style={{ animationDelay: `${index * 150}ms`, animationFillMode: 'both' }}
    >
      <div className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-accent mb-3">
        {count}{stat.suffix}
      </div>
      <p className="text-muted-foreground text-sm md:text-base tracking-wide uppercase">
        {language === 'ko' ? stat.labelKo : stat.labelEn}
      </p>
    </div>
  );
}

export function StatsSection() {
  const { language } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section 
      ref={sectionRef}
      className="py-20 md:py-28 px-6 bg-primary text-primary-foreground"
    >
      <div className="container max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-sm font-medium text-accent tracking-widest uppercase mb-4 block">
            Our Track Record
          </span>
          <h2 className="text-3xl md:text-4xl font-serif font-semibold">
            {language === 'ko' ? '검증된 성과' : 'Proven Results'}
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {stats.map((stat, index) => (
            <StatCard key={index} stat={stat} index={index} isVisible={isVisible} />
          ))}
        </div>

        <p className="text-center text-sm text-primary-foreground/70 mt-12 max-w-2xl mx-auto">
          {language === 'ko'
            ? '* 상기 수치는 예시이며, 실제 성과는 다를 수 있습니다.'
            : '* The figures above are illustrative and actual results may vary.'}
        </p>
      </div>
    </section>
  );
}
