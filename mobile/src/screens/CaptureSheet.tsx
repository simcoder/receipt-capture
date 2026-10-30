import { useEffect, useRef, type ReactNode } from "react";
import { Animated, PanResponder, StyleSheet, useWindowDimensions, View } from "react-native";
import { colors } from "../theme/colors";

export function CaptureSheet(props: { children: ReactNode; onDismiss: () => void }) {
  const { height } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(height)).current;
  const dismissRef = useRef(props.onDismiss);
  dismissRef.current = props.onDismiss;
  const heightRef = useRef(height);
  heightRef.current = height;

  useEffect(() => {
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 3 }).start();
  }, [translateY]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_, gesture) => {
        translateY.setValue(Math.max(0, gesture.dy));
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 120 || gesture.vy > 1) {
          Animated.timing(translateY, {
            toValue: heightRef.current,
            duration: 180,
            useNativeDriver: true,
          }).start(({ finished }) => {
            if (finished) dismissRef.current();
          });
          return;
        }
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
      },
    }),
  ).current;

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View
          accessibilityLabel="Pull down to dismiss"
          testID="sheet-handle"
          style={styles.handleHit}
          {...pan.panHandlers}
        >
          <View style={styles.handle} />
        </View>
        {props.children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  sheet: {
    flex: 1,
    marginTop: 8,
    backgroundColor: colors.background,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: "hidden",
  },
  handleHit: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#c5ccc8",
  },
});
