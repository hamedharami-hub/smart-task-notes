package app.lovable.d7e345911914455da5aa800df1140813;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

public class ArshnazWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_arshnaz);
            
            // Set Persian Date
            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("EEEE dd MMMM", new java.util.Locale("fa"));
            String dateStr = sdf.format(new java.util.Date());
            views.setTextViewText(R.id.widget_date, dateStr);
            
            // 1. Container click -> Open Today View
            Intent openAppIntent = new Intent(context, MainActivity.class);
            openAppIntent.setAction(Intent.ACTION_VIEW);
            openAppIntent.setData(Uri.parse("arshnaz://today"));
            PendingIntent openAppPendingIntent = PendingIntent.getActivity(
                context, 101, openAppIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_container, openAppPendingIntent);

            // 2. Add Task button -> Open Quick Add Task
            Intent addTaskIntent = new Intent(context, MainActivity.class);
            addTaskIntent.setAction(Intent.ACTION_VIEW);
            addTaskIntent.setData(Uri.parse("arshnaz://add_task"));
            PendingIntent addTaskPendingIntent = PendingIntent.getActivity(
                context, 102, addTaskIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_add_task, addTaskPendingIntent);

            // 3. Checkin button -> Open Daily Checkin
            Intent checkinIntent = new Intent(context, MainActivity.class);
            checkinIntent.setAction(Intent.ACTION_VIEW);
            checkinIntent.setData(Uri.parse("arshnaz://checkin"));
            PendingIntent checkinPendingIntent = PendingIntent.getActivity(
                context, 103, checkinIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_checkin, checkinPendingIntent);

            // 4. Garden button -> Open Mind Garden
            Intent gardenIntent = new Intent(context, MainActivity.class);
            gardenIntent.setAction(Intent.ACTION_VIEW);
            gardenIntent.setData(Uri.parse("arshnaz://garden"));
            PendingIntent gardenPendingIntent = PendingIntent.getActivity(
                context, 104, gardenIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_garden_btn, gardenPendingIntent);

            appWidgetManager.updateAppWidget(appWidgetId, views);
        }
    }
}

