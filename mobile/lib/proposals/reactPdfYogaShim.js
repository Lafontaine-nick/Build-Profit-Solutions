// CommonJS package: no real `default` export — `import yoga from` is undefined in Metro.
import * as yogaPrebuilt from "yoga-layout-prebuilt";

const yoga = yogaPrebuilt.default ?? yogaPrebuilt;
if (!yoga || typeof yoga.Config !== "function" || typeof yoga.Node !== "function") {
  throw new Error(
    "[reactPdfYogaShim] yoga-layout-prebuilt failed to load (missing Config/Node).",
  );
}

const Align = {
  Auto: yoga.ALIGN_AUTO,
  FlexStart: yoga.ALIGN_FLEX_START,
  Center: yoga.ALIGN_CENTER,
  FlexEnd: yoga.ALIGN_FLEX_END,
  Stretch: yoga.ALIGN_STRETCH,
  Baseline: yoga.ALIGN_BASELINE,
  SpaceBetween: yoga.ALIGN_SPACE_BETWEEN,
  SpaceAround: yoga.ALIGN_SPACE_AROUND,
  SpaceEvenly: yoga.ALIGN_SPACE_EVENLY,
};

const Display = {
  Flex: yoga.DISPLAY_FLEX,
  None: yoga.DISPLAY_NONE,
  Contents: yoga.DISPLAY_CONTENTS ?? yoga.DISPLAY_FLEX,
};

const Edge = {
  Left: yoga.EDGE_LEFT,
  Top: yoga.EDGE_TOP,
  Right: yoga.EDGE_RIGHT,
  Bottom: yoga.EDGE_BOTTOM,
  Start: yoga.EDGE_START,
  End: yoga.EDGE_END,
  Horizontal: yoga.EDGE_HORIZONTAL,
  Vertical: yoga.EDGE_VERTICAL,
  All: yoga.EDGE_ALL,
};

const FlexDirection = {
  Column: yoga.FLEX_DIRECTION_COLUMN,
  ColumnReverse: yoga.FLEX_DIRECTION_COLUMN_REVERSE,
  Row: yoga.FLEX_DIRECTION_ROW,
  RowReverse: yoga.FLEX_DIRECTION_ROW_REVERSE,
};

const Gutter = {
  Column: 0,
  Row: 1,
  All: 2,
};

const Justify = {
  FlexStart: yoga.JUSTIFY_FLEX_START,
  Center: yoga.JUSTIFY_CENTER,
  FlexEnd: yoga.JUSTIFY_FLEX_END,
  SpaceBetween: yoga.JUSTIFY_SPACE_BETWEEN,
  SpaceAround: yoga.JUSTIFY_SPACE_AROUND,
  SpaceEvenly: yoga.JUSTIFY_SPACE_EVENLY,
};

const MeasureMode = {
  Undefined: yoga.MEASURE_MODE_UNDEFINED,
  Exactly: yoga.MEASURE_MODE_EXACTLY,
  AtMost: yoga.MEASURE_MODE_AT_MOST,
};

const Overflow = {
  Visible: yoga.OVERFLOW_VISIBLE,
  Hidden: yoga.OVERFLOW_HIDDEN,
  Scroll: yoga.OVERFLOW_SCROLL,
};

const PositionType = {
  Static: yoga.POSITION_TYPE_STATIC ?? yoga.POSITION_TYPE_RELATIVE,
  Relative: yoga.POSITION_TYPE_RELATIVE,
  Absolute: yoga.POSITION_TYPE_ABSOLUTE,
};

const Wrap = {
  NoWrap: yoga.WRAP_NO_WRAP,
  Wrap: yoga.WRAP_WRAP,
  WrapReverse: yoga.WRAP_WRAP_REVERSE,
};

const Unit = {
  Undefined: yoga.UNIT_UNDEFINED,
  Point: yoga.UNIT_POINT,
  Percent: yoga.UNIT_PERCENT,
  Auto: yoga.UNIT_AUTO,
};

const Direction = {
  Inherit: yoga.DIRECTION_INHERIT,
  LTR: yoga.DIRECTION_LTR,
  RTL: yoga.DIRECTION_RTL,
};

const patch = (target, name, fn) => {
  const original = target[name];
  if (typeof original !== "function") {
    return;
  }
  target[name] = function patchedMethod(...args) {
    return fn.call(this, original, ...args);
  };
};

const patchYoga = (lib) => {
  const proto = lib.Node.prototype;

  for (const fnName of [
    "setPosition",
    "setMargin",
    "setFlexBasis",
    "setWidth",
    "setHeight",
    "setMinWidth",
    "setMinHeight",
    "setMaxWidth",
    "setMaxHeight",
    "setPadding",
  ]) {
    const methods = {
      [Unit.Point]: proto[fnName],
      [Unit.Percent]: proto[`${fnName}Percent`],
      [Unit.Auto]: proto[`${fnName}Auto`],
    };

    patch(proto, fnName, function wrapValue(original, ...args) {
      const value = args.pop();
      let unit;
      let numericValue;

      if (value === "auto") {
        unit = Unit.Auto;
      } else if (value && typeof value === "object" && "unit" in value) {
        unit = value.unit;
        numericValue = typeof value.valueOf === "function" ? value.valueOf() : undefined;
      } else {
        unit =
          typeof value === "string" && value.endsWith("%") ? Unit.Percent : Unit.Point;
        numericValue = parseFloat(value);
        if (value !== undefined && !Number.isNaN(value) && Number.isNaN(numericValue)) {
          throw new Error(`Invalid value ${value} for ${fnName}`);
        }
      }

      const method = methods[unit] || original;
      if (typeof method !== "function") {
        return undefined;
      }

      if (numericValue !== undefined) {
        return method.call(this, ...args, numericValue);
      }

      return method.call(this, ...args);
    });
  }

  if (typeof proto.setGap !== "function") {
    proto.setGap = function setGap() {
      return undefined;
    };
  }
  if (typeof proto.setGapPercent !== "function") {
    proto.setGapPercent = function setGapPercent() {
      return undefined;
    };
  }
  if (typeof proto.setBoxSizing !== "function") {
    proto.setBoxSizing = function setBoxSizing() {
      return undefined;
    };
  }

  patch(proto, "setMeasureFunc", function wrapMeasure(original, measureFunc) {
    if (!measureFunc) {
      return typeof this.unsetMeasureFunc === "function"
        ? this.unsetMeasureFunc()
        : undefined;
    }
    return original.call(this, measureFunc);
  });

  patch(proto, "calculateLayout", function withDefaults(
    original,
    width = Number.NaN,
    height = Number.NaN,
    direction = Direction.LTR,
  ) {
    return original.call(this, width, height, direction);
  });

  return lib;
};

const compatYoga = patchYoga({
  Config: yoga.Config,
  Node: yoga.Node,
  Align,
  Display,
  Edge,
  FlexDirection,
  Gutter,
  Justify,
  MeasureMode,
  Overflow,
  PositionType,
  Wrap,
});

export const loadYoga = async () => compatYoga;
export {
  Align,
  Display,
  Edge,
  FlexDirection,
  Gutter,
  Justify,
  MeasureMode,
  Overflow,
  PositionType,
  Wrap,
};

export default compatYoga;
