<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deliveries', function (Blueprint $table) {
            $table->string('logistics_region', 32)->nullable()->after('logistics_provider');
            $table->string('logistics_branch_id', 64)->nullable()->after('logistics_station_city');
        });
    }

    public function down(): void
    {
        Schema::table('deliveries', function (Blueprint $table) {
            $table->dropColumn(['logistics_region', 'logistics_branch_id']);
        });
    }
};
