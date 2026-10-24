/** Marks placeholder pages whose content is sample data until the EJ backend exists. */
export function SampleNotice({ children }: { children: string }) {
  return <p className="notice">{children}</p>;
}
