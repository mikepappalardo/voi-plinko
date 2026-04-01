import { useEffect, useRef, useCallback } from 'react';
import Matter from 'matter-js';
import { BOARD_CONFIG, PAYOUT_TABLES, RiskLevel, BoardSize } from '@/config/gameConfig';

interface PlinkoBoardProps {
  risk: RiskLevel;
  rows: BoardSize;
  onBallLand: (bucketIndex: number, multiplier: number) => void;
  dropTrigger: number;
  forceBucket?: number | null;
}

export default function PlinkoBoard({ risk, rows, onBallLand, dropTrigger, forceBucket }: PlinkoBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const bucketSensorsRef = useRef<Matter.Body[]>([]);
  const lastTriggerRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const { pegRadius, ballRadius, pegGap } = BOARD_CONFIG;
  const bucketCount = rows;

  const getCanvasSize = useCallback(() => {
    const maxWidth = Math.min(containerRef.current?.clientWidth ?? 500, 500);
    const width = maxWidth;
    const height = width * 1.2;
    return { width, height };
  }, []);

  // Initialize engine
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const { width, height } = getCanvasSize();

    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 1.2, scale: 0.001 },
    });

    const render = Matter.Render.create({
      canvas: canvasRef.current,
      engine,
      options: {
        width,
        height,
        wireframes: false,
        background: 'transparent',
        pixelRatio: window.devicePixelRatio || 1,
      },
    });

    engineRef.current = engine;
    renderRef.current = render;

    // Build pegs
    const pegs: Matter.Body[] = [];
    const startX = width / 2;
    const startY = 40;
    const gapX = pegGap;
    const gapY = (height - 100) / rows;

    for (let row = 2; row < rows + 2; row++) {
      const pegsInRow = row + 1;
      const rowWidth = pegsInRow * gapX;
      const offsetX = startX - rowWidth / 2 + gapX / 2;

      for (let col = 0; col < pegsInRow; col++) {
        const x = offsetX + col * gapX;
        const y = startY + (row - 2) * gapY;

        const peg = Matter.Bodies.circle(x, y, pegRadius, {
          isStatic: true,
          render: {
            fillStyle: 'hsl(165, 80%, 45%)',
          },
          restitution: 0.5,
          friction: 0.1,
        });
        pegs.push(peg);
      }
    }

    // Walls
    const wallThickness = 20;
    const walls = [
      Matter.Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height, {
        isStatic: true,
        render: { visible: false },
      }),
      Matter.Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height, {
        isStatic: true,
        render: { visible: false },
      }),
      Matter.Bodies.rectangle(width / 2, height + wallThickness / 2, width, wallThickness, {
        isStatic: true,
        render: { visible: false },
      }),
    ];

    // Bucket dividers & sensors
    const bucketY = height - 30;
    const bucketWidth = (width - 20) / bucketCount;
    const dividers: Matter.Body[] = [];
    const sensors: Matter.Body[] = [];

    for (let i = 0; i <= bucketCount; i++) {
      const x = 10 + i * bucketWidth;
      const divider = Matter.Bodies.rectangle(x, bucketY, 3, 30, {
        isStatic: true,
        render: { fillStyle: 'hsl(228, 20%, 25%)' },
        chamfer: { radius: 1.5 },
      });
      dividers.push(divider);
    }

    for (let i = 0; i < bucketCount; i++) {
      const x = 10 + i * bucketWidth + bucketWidth / 2;
      const sensor = Matter.Bodies.rectangle(x, height - 10, bucketWidth - 6, 20, {
        isStatic: true,
        isSensor: true,
        render: { visible: false },
        label: `bucket-${i}`,
      });
      sensors.push(sensor);
    }

    bucketSensorsRef.current = sensors;

    Matter.Composite.add(engine.world, [...pegs, ...walls, ...dividers, ...sensors]);

    const runner = Matter.Runner.create();
    runnerRef.current = runner;
    Matter.Runner.run(runner, engine);
    Matter.Render.run(render);

    // Draw bucket labels
    Matter.Events.on(render, 'afterRender', () => {
      const ctx = render.context;
      const config = PAYOUT_TABLES[rows][risk];

      for (let i = 0; i < bucketCount; i++) {
        const x = 10 + i * bucketWidth + bucketWidth / 2;
        const multiplier = config.multipliers[i];

        // Bucket background
        ctx.fillStyle = config.colors[i];
        ctx.globalAlpha = 0.3;
        ctx.fillRect(10 + i * bucketWidth + 2, bucketY - 15, bucketWidth - 4, 30);
        ctx.globalAlpha = 1;

        // Label
        ctx.fillStyle = '#e2e8f0';
        ctx.font = `${Math.min(10, bucketWidth * 0.35)}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${multiplier}x`, x, bucketY);
      }
    });

    return () => {
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      Matter.Engine.clear(engine);
      Matter.Composite.clear(engine.world, false);
    };
  }, [getCanvasSize, rows, pegRadius, pegGap, bucketCount, risk]);

  // Handle ball drops
  useEffect(() => {
    if (dropTrigger <= lastTriggerRef.current) return;
    lastTriggerRef.current = dropTrigger;

    const engine = engineRef.current;
    if (!engine) return;

    const { width } = getCanvasSize();
    // If forceBucket is set (on-chain mode), aim ball at that bucket's X position
    let dropX = width / 2;
    if (forceBucket != null) {
      const numBuckets = rows + 1;
      const totalWidth = numBuckets * pegGap;
      const startX = (width - totalWidth) / 2 + pegGap / 2;
      dropX = startX + forceBucket * pegGap;
    } else {
      dropX = width / 2 + (Math.random() - 0.5) * 20;
    }

    const ball = Matter.Bodies.circle(dropX, 10, ballRadius, {
      restitution: 0.4,
      friction: 0.05,
      density: 0.002,
      render: {
        fillStyle: 'hsl(45, 100%, 55%)',
      },
      label: 'ball',
    });

    Matter.Composite.add(engine.world, ball);

    // Collision detection for bucket landing
    const handler = (event: Matter.IEventCollision<Matter.Engine>) => {
      for (const pair of event.pairs) {
        const sensorBody =
          pair.bodyA.label?.startsWith('bucket-') ? pair.bodyA :
          pair.bodyB.label?.startsWith('bucket-') ? pair.bodyB : null;
        const ballBody =
          pair.bodyA.label === 'ball' ? pair.bodyA :
          pair.bodyB.label === 'ball' ? pair.bodyB : null;

        if (sensorBody && ballBody && ballBody.id === ball.id) {
          const bucketIndex = parseInt(sensorBody.label!.split('-')[1]);
          const config = PAYOUT_TABLES[rows][risk];
          const multiplier = config.multipliers[bucketIndex];
          onBallLand(bucketIndex, multiplier);

          // Remove ball after short delay
          setTimeout(() => {
            Matter.Composite.remove(engine.world, ball);
          }, 500);

          Matter.Events.off(engine, 'collisionStart', handler);
        }
      }
    };

    Matter.Events.on(engine, 'collisionStart', handler);

    // Safety cleanup
    setTimeout(() => {
      try { Matter.Composite.remove(engine.world, ball); } catch {}
      Matter.Events.off(engine, 'collisionStart', handler);
    }, 8000);
  }, [dropTrigger, risk, onBallLand, ballRadius, getCanvasSize]);

  return (
    <div ref={containerRef} className="flex flex-col items-center w-full max-w-[500px] mx-auto">
      <canvas
        ref={canvasRef}
        width={getCanvasSize().width}
        height={getCanvasSize().height}
        className="rounded-xl w-full"
        style={{ maxWidth: 500 }}
      />
    </div>
  );
}
