/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2020 Red Hat, Inc.
 *
 * Cockpit is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation; either version 2.1 of the License, or
 * (at your option) any later version.
 *
 * Cockpit is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Cockpit; If not, see <http://www.gnu.org/licenses/>.
 */

import cockpit from 'cockpit';
import React from 'react';
import { init } from "echarts";
import { getCGroupInfo } from './client';
import StorageUsage from './StorageUsage.jsx';

class CpuMemUsage extends React.Component {
    constructor(props) {
        super(props);

        this.memCpuUsages = {
            hostCpus: this.props.hostCpus || 1,
            lastTimeStamp: 0,
            timeData: [],
            idSet: new Set(),
            idList: [],
            memUsages: {},
            cpuUsages: {},
            maxSz: 3 * 60,
            curSz: 0,

            addRawUsages: function (usages) {
                usages = usages || {};
                for (const id in usages)
                    if (usages[id] && usages[id][0] && usages[id][0][0]) {
                        this.addUsage(
                            id, (usages[id][0][0] / 1048576).toFixed(3),
                            (usages[id][1][0] * 0.1 / this.hostCpus).toFixed(3));
                    }
                this.idList.forEach(id => {
                    if (!(usages[id] && usages[id][0] && usages[id][0][0]))
                        this.addUsage(id);
                });

                if (this.lastTimeStamp == 0)
                    this.lastTimeStamp = Date.now() - 1000;
                this.timeData.push(new Date(this.lastTimeStamp + 1000)
                        .toTimeString()
                        .substr(0, 8));
                if (this.timeData.length > this.maxSz)
                    this.timeData.shift();
                this.lastTimeStamp += 1000;
                if (this.curSz < this.maxSz)
                    this.curSz += 1;
            },
            addUsage: function (containerId, memUsage, cpuUsage) {
                if (!this.idSet.has(containerId)) {
                    this.idList.unshift(containerId);
                    this.idSet.add(containerId);
                    this.memUsages[containerId] = new Array(this.curSz);
                    this.cpuUsages[containerId] = new Array(this.curSz);
                }
                this.memUsages[containerId].push(memUsage);
                this.cpuUsages[containerId].push(cpuUsage);
                if (this.memUsages[containerId].length > this.maxSz) {
                    this.memUsages[containerId].shift();
                    this.cpuUsages[containerId].shift();
                }
            },
            getMemUsages: function () {
                var resMemUsages = [];
                for (let i = this.idList.length - 1; i >= 0; i--)
                    resMemUsages.push(this.memUsages[this.idList[i]]);
                return resMemUsages;
            },
            getCpuUsages: function () {
                var resCpuUsages = [];
                for (let i = this.idList.length - 1; i >= 0; i--)
                    resCpuUsages.push(this.cpuUsages[this.idList[i]]);
                return resCpuUsages;
            }
        };
        this.initCharts = this.initCharts.bind(this);
        this.makeSeriesOption = this.makeSeriesOption.bind(this);
        this.updateChartsData = this.updateChartsData.bind(this);
        this.onNotifyCGroupInfo = this.onNotifyCGroupInfo.bind(this);
        this.goToStorage = this.goToStorage.bind(this);
    }

    initCharts() {
        this.memChart = init(document.getElementById("memGraph"));
        this.cpuChart = init(document.getElementById("cpuGraph"));

        var initOption = {
            title: { show: false },
            grid: {
                left: 20,
                right: 10,
                top: 10,
                bottom: 0,
                containLabel: true,
                show: true,
                borderWidth: 1,
                borderColor: "#aaa",
            },
            legend: { show: false },
            xAxis: [{
                type: 'category',
                boundaryGap: false,
                axisTick: false,
                data: [new Date(Date.now()).toTimeString()
                        .substr(0, 8)],
                axisLabel: { interval: 30 },
                axisLine: { lineStyle: { opacity: 0 } },
            }],
            yAxis: [{
                type: 'value',
                axisTick: false,
                axisLine: { lineStyle: { opacity: 0 } },
                min: 0.00,
            }],
            color: ["#1E3F66", "#2E5984", "#528AAE", "#73A5C6", "#91BAD6", "#BCD2E8"],
            series: [{ id: '0', data: [0.000], type: 'line', symbol: 'none' }],
        };

        // memory charts
        this.memChart.setOption(initOption);
        // cpu charts
        initOption.yAxis[0].max = 100;
        initOption.yAxis[0].axisLabel = { showMaxLabel: true };
        this.cpuChart.setOption(initOption);
    }

    makeSeriesOption(data, xdata, smooth) {
        var series = [];
        for (let i = 0; i < data.length; i++) {
            series.push({
                type: 'line',
                stack: 'total',
                areaStyle: { normal: {} },
                smooth: !!smooth,
                data: data[i],
                symbol: 'none',
                lineStyle: { width: 1 }
            });
        }
        return {
            xAxis: { data: xdata },
            series: series
        };
    }

    updateChartsData(usages) {
        this.memCpuUsages.addRawUsages(usages);

        var memUsage = this.memCpuUsages.getMemUsages();
        var cpuUsage = this.memCpuUsages.getCpuUsages();
        var empty = true;
        for (let i = 0; i < (memUsage || []).length && empty; i++)
            for (let j = 0; j < (memUsage[i] || []).length && empty; j++)
                if (memUsage[i][j])
                    empty = false;
        // no real data, add 0 to show grid on chart
        if (empty)
            memUsage = cpuUsage = [[0.0]];
        this.memChart.setOption(this.makeSeriesOption(memUsage, this.memCpuUsages.timeData));
        this.cpuChart.setOption(this.makeSeriesOption(cpuUsage, this.memCpuUsages.timeData));
    }

    onNotifyCGroupInfo(usages) {
        if (usages[-1])
            this.updateChartsData();
        else
            this.updateChartsData(usages);
    }

    componentDidMount() {
        this.initCharts();
        this.usageGrid = getCGroupInfo(this.onNotifyCGroupInfo);
    }

    componentWillUnmount() {
        if (this.usageGrid && this.usageGrid.close)
            this.usageGrid.close();
        this.usageGrid = null;
    }

    goToStorage() {
        cockpit.jump("/storage");
    }

    render() {
        const coreStr = "% Combined Usage of " + this.memCpuUsages.hostCpus + " " + (this.memCpuUsages.hostCpus > 1 ? "cores" : "core");
        return <div className="res-usage-holder">
            <div className="cpu-mem-usage-graph">
                <div className="cpu-mem-uage-title">&nbsp;&nbsp;{coreStr}</div>
                <div id="cpuGraph" />
            </div>
            <div className="cpu-mem-usage-graph">
                <div className="cpu-mem-uage-title">MiB Combined Memory Usage</div>
                <div id="memGraph" />
            </div>
            <StorageUsage
                key="storageusage"
                totalStorageUsage={this.props.totalStorageUsage} />
        </div>;
    }
}

export default CpuMemUsage;
