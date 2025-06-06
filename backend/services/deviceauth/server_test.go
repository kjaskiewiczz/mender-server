package main

import (
	"fmt"
	"testing"

	"github.com/spf13/viper"
	"github.com/stretchr/testify/assert"

	dconfig "github.com/mendersoftware/mender-server/services/deviceauth/config"
	"github.com/mendersoftware/mender-server/services/deviceauth/devauth"
)

func TestSetupRateLimits(t *testing.T) {
	t.Parallel()

	type testCase struct {
		Config *viper.Viper

		Error error
	}

	for name, _tc := range map[string]testCase{
		"ok/slice": {
			Config: func() *viper.Viper {
				cfg := viper.New()
				cfg.Set(dconfig.SettingRatelimitsDevicesEnable, "true")
				cfg.Set(dconfig.SettingRatelimitsDevicesQuotaPlan, "enterprise=1.5 professional=0.75 os=0.5")
				return cfg
			}(),
		},
		"ok/map": {
			Config: func() *viper.Viper {
				cfg := viper.New()
				cfg.Set(dconfig.SettingRatelimitsDevicesEnable, "true")
				cfg.Set(dconfig.SettingRatelimitsDevicesQuotaPlan, map[string]any{
					"enterprise":   float64(2.5),
					"professional": int(2),
					"os":           uint64(1),
				})
				return cfg
			}(),
		},
		"ok/no limits": {
			Config: func() *viper.Viper {
				cfg := viper.New()
				return cfg
			}(),
		},
		"error/negative value": {
			Config: func() *viper.Viper {
				cfg := viper.New()
				cfg.Set(dconfig.SettingRatelimitsDevicesEnable, "true")
				cfg.Set(dconfig.SettingRatelimitsDevicesQuotaPlan, map[string]any{"bad": -1.0})
				return cfg
			}(),
			Error: fmt.Errorf("invalid config value %s[bad]: must be a positive value",
				dconfig.SettingRatelimitsDevicesQuotaPlan),
		},
		"error/slice without separator": {
			Config: func() *viper.Viper {
				cfg := viper.New()
				cfg.Set(dconfig.SettingRatelimitsDevicesEnable, "true")
				cfg.Set(dconfig.SettingRatelimitsDevicesQuotaPlan, "foo bar baz")
				return cfg
			}(),
			Error: fmt.Errorf("invalid config %s: value %v item #1: missing key/value separator '='",
				dconfig.SettingRatelimitsDevicesQuotaPlan, []string{"foo", "bar", "baz"}),
		},
		"error/not convertible to float": {
			Config: func() *viper.Viper {
				cfg := viper.New()
				cfg.Set(dconfig.SettingRatelimitsDevicesEnable, "true")
				cfg.Set(dconfig.SettingRatelimitsDevicesQuotaPlan, "enterprise=many")
				return cfg
			}(),
			Error: fmt.Errorf("error parsing quota value"),
		},
		"error/unexpected map type": {
			Config: func() *viper.Viper {
				cfg := viper.New()
				cfg.Set(dconfig.SettingRatelimitsDevicesEnable, "true")
				cfg.Set(dconfig.SettingRatelimitsDevicesQuotaPlan, map[string]any{"foo": "123"})
				return cfg
			}(),
			Error: fmt.Errorf("invalid config value %s[foo]: "+
				"not a numeric value",
				dconfig.SettingRatelimitsDevicesQuotaPlan),
		},
		"error/bad default quota": {
			Config: func() *viper.Viper {
				cfg := viper.New()
				cfg.Set(dconfig.SettingRatelimitsDevicesEnable, "true")
				cfg.Set(dconfig.SettingRatelimitsDevicesQuotaDefault, -1)
				return cfg
			}(),
			Error: fmt.Errorf("invalid config value %s: must be a positive value",
				dconfig.SettingRatelimitsDevicesQuotaDefault),
		},
	} {
		tc := _tc
		t.Run(name, func(t *testing.T) {
			da := &devauth.DevAuth{}
			err := setupRatelimits(tc.Config, da, "n/a", nil)
			if tc.Error != nil {
				assert.ErrorContains(t, err, tc.Error.Error())
			} else {
				assert.NoError(t, err)
			}
		})
	}

}
