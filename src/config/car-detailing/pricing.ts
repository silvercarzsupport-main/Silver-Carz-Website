export const carDetailingCategories = ['Hatchback', 'Sedan', 'SUV / MUV'] as const;

export type CarDetailingRateRow = {
  service: string;
  prices: [string, string, string];
  range: [number, number];
};

export const carDetailingRateCard: CarDetailingRateRow[] = [
  {
    service: 'Basic Water Wash',
    prices: ['₹200', '₹250', '₹300'],
    range: [200, 300],
  },
  {
    service: 'Touchless Shampoo Wash',
    prices: ['₹350', '₹400', '₹450'],
    range: [350, 450],
  },
  {
    service: 'Touchless Wash + Vacuum + Tyre Polish + Interior Polish',
    prices: ['₹600', '₹700', '₹800'],
    range: [600, 800],
  },
  {
    service: 'Premium Car Spa (Touchless Wash + Vacuum + Tyre Polish + Interior Polish + Wax)',
    prices: ['₹1,200', '₹1,400', '₹1,600'],
    range: [1200, 1600],
  },
  {
    service: 'Interior Deep Cleaning',
    prices: ['₹2,000', '₹2,500', '₹2,800'],
    range: [2000, 2800],
  },
  {
    service: 'Engine Bay Cleaning',
    prices: ['₹600', '₹650', '₹700'],
    range: [600, 700],
  },
  {
    service: 'Ceramic / PPF Shampoo Wash',
    prices: ['₹700', '₹750', '₹800'],
    range: [700, 800],
  },
  {
    service:
      'Premium Detailing Wash (Interior Deep Cleaning + Engine Bay Cleaning + Exterior Detailing + Wax)',
    prices: ['₹3,000', '₹3,500', '₹4,000'],
    range: [3000, 4000],
  },
  {
    service: 'Rubbing & Polishing',
    prices: ['₹2,500', '₹2,800', '₹3,500'],
    range: [2500, 3500],
  },
  {
    service: 'Ceramic Coating',
    prices: ['₹13,000', '₹15,000', '₹18,000'],
    range: [13000, 18000],
  },
];

export const carDetailingAlsoDone = ['Denting', 'Painting', 'Service', 'Repairing'];
