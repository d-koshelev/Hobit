import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

type HookResult<TResult> = {
  current: TResult;
};

export function renderHook<TResult, TProps>(
  hook: (props: TProps) => TResult,
  initialProps: TProps,
) {
  let root: Root | null = null;
  const result = {} as HookResult<TResult>;
  const container = document.createElement("div");
  document.body.append(container);

  function HookTestComponent({ props }: { props: TProps }): ReactNode {
    result.current = hook(props);
    return null;
  }

  act(() => {
    root = createRoot(container);
    root.render(<HookTestComponent props={initialProps} />);
  });

  return {
    result,
    rerender(nextProps: TProps) {
      act(() => {
        root?.render(<HookTestComponent props={nextProps} />);
      });
    },
    unmount() {
      act(() => {
        root?.unmount();
      });
      container.remove();
    },
  };
}

export async function flushHookEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}
