package app.lovable.d7e345911914455da5aa800df1140813;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                            ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                            : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        handleWidgetIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleWidgetIntent(intent);
    }

    private void handleWidgetIntent(Intent intent) {
        String action = intent.getAction();
        Uri data = intent.getData();
        
        if (data != null && data.getScheme() != null && data.getScheme().equals("arshnaz")) {
            String path = data.getPath();
            if (path != null) {
                if (path.equals("/add_task")) {
                    // Navigate to new task page
                    loadUrl("javascript:window.location.href = '/app/new/task'");
                } else if (path.equals("/today")) {
                    // Navigate to today page
                    loadUrl("javascript:window.location.href = '/app/today'");
                }
            }
        }
    }
}
