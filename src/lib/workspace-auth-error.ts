export interface GoogleSignInErrorInfo {
  notice: string;
  openTabUrl: string | null;
}

export function isSameOriginAuthHost(hostname: string): boolean {
  return (
    hostname.endsWith(".run.app") ||
    hostname.endsWith(".firebaseapp.com") ||
    hostname.endsWith(".web.app")
  );
}

export function formatGoogleSignInError(params: {
  error: unknown;
  isEmbedded: boolean;
  currentUrl: string | null;
}): GoogleSignInErrorInfo {
  const { error, isEmbedded, currentUrl } = params;
  const code =
    error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const rawMessage = error instanceof Error ? error.message : "";

  if (code === "auth/redirect-cancelled-by-user") {
    return {
      notice: "تم إلغاء تسجيل الدخول قبل إكمال الموافقة.",
      openTabUrl: null,
    };
  }

  if (code === "auth/redirect-operation-pending") {
    return {
      notice: "عملية تسجيل دخول قيد التنفيذ بالفعل، انتظر لحظة ثم حاول مجدداً.",
      openTabUrl: null,
    };
  }

  const isPopupClosed =
    code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request";

  const isProxyOrPopupEnvError =
    /proxy/i.test(rawMessage) ||
    code === "auth/popup-blocked" ||
    code === "auth/web-storage-unsupported" ||
    code === "auth/operation-not-supported-in-this-environment";

  if (isPopupClosed) {
    if (isEmbedded) {
      return {
        notice:
          "تعذّر إتمام تسجيل الدخول من داخل المعاينة المضمّنة لأن المتصفح يفصل نوافذ المصادقة داخل الإطارات. افتح التطبيق في تبويب مستقل ثم اضغط «Sign in with Google».",
        openTabUrl: currentUrl,
      };
    }
    return {
      notice:
        "تم إغلاق نافذة تسجيل الدخول قبل إتمام الربط. أكمل الموافقة داخل النافذة المنبثقة ولا تغلقها، وتأكد من عدم حظر النوافذ المنبثقة أو ملفات الارتباط.",
      openTabUrl: null,
    };
  }

  if (isProxyOrPopupEnvError) {
    if (isEmbedded) {
      return {
        notice:
          "المعاينة المضمّنة منعت نافذة تسجيل الدخول. افتح التطبيق في تبويب مستقل ثم اضغط «Sign in with Google».",
        openTabUrl: currentUrl,
      };
    }
    return {
      notice: "منع المتصفح نافذة تسجيل الدخول. اسمح بالنوافذ المنبثقة ثم حاول مجدداً.",
      openTabUrl: null,
    };
  }

  if (code === "auth/unauthorized-domain") {
    return {
      notice:
        "هذا النطاق غير مضاف في Firebase Authorized Domains. افتح رابط التطبيق المنشور أو أضف النطاق في Firebase Console.",
      openTabUrl: isEmbedded ? currentUrl : null,
    };
  }

  if (isEmbedded) {
    return {
      notice:
        "تعذّر إكمال الربط من داخل المعاينة المضمّنة. افتح التطبيق في تبويب مستقل ثم اضغط «Sign in with Google».",
      openTabUrl: currentUrl,
    };
  }

  return {
    notice: rawMessage || "تعذّر تسجيل الدخول بحساب Google.",
    openTabUrl: null,
  };
}
