import { useEffect, useState } from "react";
import { Select } from "antd";
import { api, errorMessage } from "../../api/client";
import type {
  CoefficientOptions,
  CoefficientOptionsQuery,
} from "../../api/types";

export function CoefficientFilter({
  label,
  query,
  disabled,
  value,
  onChange,
}: {
  label: string;
  query: CoefficientOptionsQuery;
  disabled: boolean;
  value?: string;
  onChange?: (value: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<CoefficientOptions["list"]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const queryKey = JSON.stringify(query);

  useEffect(() => {
    if (!open || disabled) return;
    const controller = new AbortController();
    setOptions([]);
    setError("");
    setLoading(true);
    // 打开下拉时读取完整去重选项，条件变化或收起后取消旧请求。
    api
      .coefficientOptions(JSON.parse(queryKey), controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setOptions(data.list);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(errorMessage(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, disabled, queryKey]);

  return (
    <Select
      aria-label={label}
      placeholder={`${label}：全部`}
      value={value}
      onChange={onChange}
      allowClear
      showSearch={{ optionFilterProp: "label" }}
      options={options}
      loading={loading && open}
      disabled={disabled || undefined}
      onOpenChange={setOpen}
      notFoundContent={
        <div
          className="filter-options-empty"
          role={error ? "alert" : undefined}
        >
          {loading ? (
            "正在加载选项…"
          ) : error ? (
            <>
              <div>选项接口尚未接入或暂时不可用</div>
              <div className="small muted">{error}</div>
              <div className="small muted">关闭后重新展开可重试</div>
            </>
          ) : (
            "当前条件下暂无选项"
          )}
        </div>
      }
    />
  );
}
