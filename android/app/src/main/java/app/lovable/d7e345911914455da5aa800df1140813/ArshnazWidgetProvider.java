package app.lovable.d7e345911914455da5aa800df1140813;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

public class ArshnazWidgetProvider extends AppWidgetProvider {
    private static final String BASE_URL = "https://d7e34591-1914-455d-a5aa-800df1140813.lovableproject.com";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_arshnaz);
            
            // Set Persian Date
            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("EEEE dd MMMM", new java.util.Locale("fa"));
            String dateStr = sdf.format(new java.util.Date());
            views.setTextViewText(R.id.widget_date, dateStr);
            
            // 1. Container click -> Open Today View
            Intent openAppIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(BASE_URL + "/app/today"));
            openAppIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            PendingIntent openAppPendingIntent = PendingIntent.getActivity(
                context, 101, openAppIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_container, openAppPendingIntent);

            // 2. Add Task button -> Open Quick Add Task
            Intent addTaskIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(BASE_URL + "/app/new/task"));
            addTaskIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            PendingIntent addTaskPendingIntent = PendingIntent.getActivity(
                context, 102, addTaskIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_add_task, addTaskPendingIntent);

            // 3. Checkin button -> Open Daily Checkin
            Intent checkinIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(BASE_URL + "/app/checkin"));
            checkinIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            PendingIntent checkinPendingIntent = PendingIntent.getActivity(
                context, 103, checkinIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_checkin, checkinPendingIntent);

            // 4. Garden button -> Open Mind Garden
            Intent gardenIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(BASE_URL + "/app/garden"));
            gardenIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            PendingIntent gardenPendingIntent = PendingIntent.getActivity(
                context, 104, gardenIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_garden_btn, gardenPendingIntent);

            appWidgetManager.updateAppWidget(appWidgetId, views);
        }
    }
}

