/** Marks pages whose content is sample data or a placeholder until the EJ backend exists. */
export function SampleNotice({ children }: { children: string }) {
  return <p className="notice">{children}</p>;
}
