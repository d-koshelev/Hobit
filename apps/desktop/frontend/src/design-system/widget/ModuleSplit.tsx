import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

export type ModuleRailOrientation = "vertical" | "horizontal";
export type ModuleSplitRegionKind = "primary" | "secondary";

type ModuleSplitProps = HTMLAttributes<HTMLDivElement> & {
  readonly children: ReactNode;
  readonly defaultPrimarySize: number;
  readonly maxPrimarySize?: number;
  readonly minPrimarySize?: number;
  readonly minSecondarySize?: number;
  readonly orientation: ModuleRailOrientation;
};

type ModuleSplitRegionProps = HTMLAttributes<HTMLDivElement> & {
  readonly children: ReactNode;
  readonly region: ModuleSplitRegionKind;
};

type ModuleRailProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  readonly children?: ReactNode;
};

type ModuleRailDragState = {
  readonly containerSize: number;
  readonly initialPointer: number;
  readonly initialPrimarySize: number;
};

type ModuleSplitContextValue = {
  readonly dragging: boolean;
  readonly maxPrimarySize?: number;
  readonly minPrimarySize: number;
  readonly minSecondarySize: number;
  readonly orientation: ModuleRailOrientation;
  readonly primarySize: number;
  readonly startRailDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

const DEFAULT_MIN_PRIMARY_SIZE = 160;
const DEFAULT_MIN_SECONDARY_SIZE = 160;

const ModuleSplitContext = createContext<ModuleSplitContextValue | null>(null);

export const ModuleSplit = forwardRef<HTMLDivElement, ModuleSplitProps>(
  function ModuleSplit(
    {
      children,
      className,
      defaultPrimarySize,
      maxPrimarySize,
      minPrimarySize = DEFAULT_MIN_PRIMARY_SIZE,
      minSecondarySize = DEFAULT_MIN_SECONDARY_SIZE,
      orientation,
      style,
      ...props
    },
    ref,
  ) {
    const splitRef = useRef<HTMLDivElement | null>(null);
    const railDrag = useRef<ModuleRailDragState | null>(null);
    const railDragCleanup = useRef<(() => void) | null>(null);
    const [dragging, setDragging] = useState(false);
    const [primarySize, setPrimarySize] = useState(() =>
      clampPrimarySize(defaultPrimarySize, {
        maxPrimarySize,
        minPrimarySize,
        minSecondarySize,
      }),
    );

    useEffect(() => {
      return () => {
        railDragCleanup.current?.();
      };
    }, []);

    const splitStyle = {
      ...style,
      "--module-split-primary-size": `${Math.round(primarySize)}px`,
      "--module-split-min-primary-size": `${Math.round(minPrimarySize)}px`,
      "--module-split-min-secondary-size": `${Math.round(minSecondarySize)}px`,
    } as CSSProperties;

    function startRailDrag(event: ReactPointerEvent<HTMLDivElement>) {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      railDragCleanup.current?.();

      const bounds = splitRef.current?.getBoundingClientRect();

      railDrag.current = {
        containerSize: getSplitSize(orientation, bounds),
        initialPointer: getPointerPosition(orientation, event),
        initialPrimarySize: primarySize,
      };
      setDragging(true);

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const drag = railDrag.current;

        if (!drag) {
          return;
        }

        const nextPrimarySize =
          drag.initialPrimarySize +
          getPointerPosition(orientation, moveEvent) -
          drag.initialPointer;

        setPrimarySize(
          clampPrimarySize(nextPrimarySize, {
            containerSize: drag.containerSize,
            maxPrimarySize,
            minPrimarySize,
            minSecondarySize,
          }),
        );
      };

      const stopDrag = () => {
        railDragCleanup.current?.();
        railDragCleanup.current = null;
        railDrag.current = null;
        setDragging(false);
      };

      railDragCleanup.current = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", stopDrag);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", stopDrag);
    }

    function setSplitRef(node: HTMLDivElement | null) {
      splitRef.current = node;

      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    }

    return (
      <ModuleSplitContext.Provider
        value={{
          dragging,
          maxPrimarySize,
          minPrimarySize,
          minSecondarySize,
          orientation,
          primarySize,
          startRailDrag,
        }}
      >
        <div
          {...props}
          className={["module-split", `module-split-${orientation}`, className]
            .filter(Boolean)
            .join(" ")}
          data-module-split
          data-module-split-orientation={orientation}
          ref={setSplitRef}
          style={splitStyle}
        >
          {children}
        </div>
      </ModuleSplitContext.Provider>
    );
  },
);

export const ModuleSplitRegion = forwardRef<
  HTMLDivElement,
  ModuleSplitRegionProps
>(function ModuleSplitRegion(
  { children, className, region, ...props },
  ref,
) {
  return (
    <div
      {...props}
      className={[
        "module-split-region",
        `module-split-region-${region}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-module-split-region={region}
      ref={ref}
    >
      {children}
    </div>
  );
});

export const ModuleRail = forwardRef<HTMLDivElement, ModuleRailProps>(
  function ModuleRail(
    { children, className, onPointerDown, ...props },
    ref,
  ) {
    const split = useModuleSplitContext("ModuleRail");

    function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
      onPointerDown?.(event);

      if (!event.defaultPrevented) {
        split.startRailDrag(event);
      }
    }

    return (
      <div
        {...props}
        aria-orientation={split.orientation}
        aria-valuemax={split.maxPrimarySize}
        aria-valuemin={split.minPrimarySize}
        aria-valuenow={Math.round(split.primarySize)}
        className={["module-rail", `module-rail-${split.orientation}`, className]
          .filter(Boolean)
          .join(" ")}
        data-module-rail
        data-module-rail-dragging={split.dragging ? "true" : "false"}
        data-module-rail-orientation={split.orientation}
        onPointerDown={handlePointerDown}
        ref={ref}
        role="separator"
      >
        {children}
      </div>
    );
  },
);

function useModuleSplitContext(componentName: string) {
  const context = useContext(ModuleSplitContext);

  if (!context) {
    throw new Error(`${componentName} must be rendered inside ModuleSplit.`);
  }

  return context;
}

function getPointerPosition(
  orientation: ModuleRailOrientation,
  event: Pick<PointerEvent, "clientX" | "clientY">,
) {
  return orientation === "vertical" ? event.clientX : event.clientY;
}

function getSplitSize(
  orientation: ModuleRailOrientation,
  bounds: DOMRect | undefined,
) {
  if (!bounds) {
    return 0;
  }

  return orientation === "vertical" ? bounds.width : bounds.height;
}

function clampPrimarySize(
  size: number,
  options: {
    readonly containerSize?: number;
    readonly maxPrimarySize?: number;
    readonly minPrimarySize: number;
    readonly minSecondarySize: number;
  },
) {
  const maxFromContainer =
    options.containerSize && options.containerSize > 0
      ? options.containerSize - options.minSecondarySize
      : undefined;
  const maxCandidates = [options.maxPrimarySize, maxFromContainer].filter(
    (candidate): candidate is number => typeof candidate === "number",
  );
  const effectiveMax =
    maxCandidates.length > 0
      ? Math.max(options.minPrimarySize, Math.min(...maxCandidates))
      : undefined;
  const clampedToMin = Math.max(size, options.minPrimarySize);

  return effectiveMax === undefined
    ? clampedToMin
    : Math.min(clampedToMin, effectiveMax);
}
