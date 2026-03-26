export const c = {
  bg: '#071626',
  card: '#0F2137',
  text: '#E5E7EB',
  sub: '#F3F4F6',
  accent: '#00C281',
  accentDark: '#0dbf83',
  warning: '#CA8A04',
  danger: '#DC2626',
  railActive: '#2EE6A4',
  railTrack: '#12263F',
};

export const radius = { lg: 20, md: 14, sm: 10 };

export const shadow = {
  card: { 
    shadowColor: '#000', 
    shadowOpacity: 0.35, 
    shadowOffset: { width: 0, height: 8 }, 
    shadowRadius: 16, 
    elevation: 8 
  },
};

export const type = {
  h1: { color: c.text, fontSize: 28, fontWeight: '800' as const },
  h2: { color: c.text, fontSize: 18, fontWeight: '800' as const },
  body: { color: c.text, fontSize: 15 },
  sub: { color: c.sub, fontSize: 13 },
};


