import { Alert, Button } from "antd";

export function RequestError({
  error,
  retry,
}: {
  error: string;
  retry?: () => void;
}) {
  if (!error) return null;
  return (
    <Alert
      className="request-error"
      type="error"
      showIcon
      title="请求未完成"
      description={error}
      action={
        retry && (
          <Button size="small" onClick={retry}>
            重试
          </Button>
        )
      }
    />
  );
}
