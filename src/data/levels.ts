export interface Planet {
  id: number;
  x: number;
  y: number;
  r: number;
  mass: number;
  type: 'attract' | 'repel';
}

export interface LevelData {
  id: number;
  name: string;
  subtitle: string;
  start: { x: number; y: number };
  target: { x: number; y: number; r: number };
  planets: Planet[];
}

export const levels: LevelData[] = [
  {
    id: 1,
    name: 'First Orbit',
    subtitle: 'Learn the pull of gravity.',
    start: { x: 150, y: 500 },
    target: { x: 850, y: 500, r: 40 },
    planets: [
      { id: 1, x: 500, y: 300, r: 60, mass: 1800, type: 'attract' }
    ]
  },
  {
    id: 2,
    name: 'Binary System',
    subtitle: 'Navigate between two heavy masses.',
    start: { x: 100, y: 800 },
    target: { x: 900, y: 200, r: 40 },
    planets: [
      { id: 1, x: 350, y: 400, r: 50, mass: 1500, type: 'attract' },
      { id: 2, x: 650, y: 600, r: 50, mass: 1500, type: 'attract' }
    ]
  },
  {
    id: 3,
    name: 'The Slingshot',
    subtitle: 'Use momentum to break free.',
    start: { x: 100, y: 100 },
    target: { x: 900, y: 900, r: 50 },
    planets: [
      { id: 1, x: 300, y: 300, r: 80, mass: 3000, type: 'attract' },
      { id: 2, x: 700, y: 700, r: 40, mass: 1000, type: 'attract' },
      { id: 3, x: 850, y: 300, r: 70, mass: 1200, type: 'attract' }
    ]
  },
  {
    id: 4,
    name: 'Dark Matter',
    subtitle: 'Repulsive forces block the direct path.',
    start: { x: 100, y: 500 },
    target: { x: 900, y: 500, r: 40 },
    planets: [
      { id: 1, x: 500, y: 500, r: 60, mass: 1800, type: 'attract' },
      { id: 2, x: 500, y: 150, r: 50, mass: 2000, type: 'repel' },
      { id: 3, x: 500, y: 850, r: 50, mass: 2000, type: 'attract' }
    ]
  },
  {
    id: 5,
    name: 'Constellation Grid',
    subtitle: 'A maze of gravitational wells.',
    start: { x: 100, y: 900 },
    target: { x: 900, y: 100, r: 40 },
    planets: [
      { id: 1, x: 300, y: 700, r: 50, mass: 1200, type: 'attract' },
      { id: 2, x: 500, y: 500, r: 60, mass: 1500, type: 'attract' },
      { id: 3, x: 700, y: 300, r: 50, mass: 1200, type: 'attract' },
      { id: 4, x: 700, y: 800, r: 60, mass: 1500, type: 'repel' },
      { id: 5, x: 200, y: 300, r: 60, mass: 1000, type: 'attract' }
    ]
  }
];
